/**
 * Federation Service
 *
 * Manages server identity and peer-to-peer communication for the void-server federation.
 * Uses Ed25519 keypairs for cryptographic identity and TweetNaCl for message signing/encryption.
 */

const nacl = require('tweetnacl');
const bs58Pkg = require('bs58');
const bs58 = bs58Pkg.default || bs58Pkg; // v6+ exposes .default in CJS
const ed2curve = require('ed2curve');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { broadcast } = require('../utils/broadcast');

// Lazy load peer-service to avoid circular dependencies
let peerServiceInstance = null;
function getPeerServiceLazy() {
  if (!peerServiceInstance) {
    const { getPeerService } = require('./peer-service');
    peerServiceInstance = getPeerService();
  }
  return peerServiceInstance;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const FEDERATION_DIR = path.join(DATA_DIR, 'federation');
const IDENTITY_PATH = path.join(FEDERATION_DIR, 'identity.json');
const PEERS_PATH = path.join(FEDERATION_DIR, 'peers.json');

/**
 * Ensure federation directory exists
 */
function ensureFederationDir() {
  if (!fs.existsSync(FEDERATION_DIR)) {
    fs.mkdirSync(FEDERATION_DIR, { recursive: true });
    console.log('🌐 Created federation directory');
  }
}

/**
 * Generate a new Ed25519 keypair for server identity
 */
function generateIdentity() {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: bs58.encode(keypair.publicKey),
    secretKey: bs58.encode(keypair.secretKey),
    createdAt: new Date().toISOString()
  };
}

/**
 * Load or create server identity
 */
function loadIdentity() {
  ensureFederationDir();

  if (fs.existsSync(IDENTITY_PATH)) {
    const identity = JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf8'));
    console.log(`🌐 Loaded server identity: ${identity.publicKey.slice(0, 8)}...`);
    return identity;
  }

  const identity = generateIdentity();
  identity.serverId = generateServerId(identity.publicKey);
  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2));
  console.log(`🌐 Generated new server identity: ${identity.publicKey.slice(0, 8)}...`);
  return identity;
}

/**
 * Generate a short, human-friendly server ID from public key
 */
function generateServerId(publicKey) {
  const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
  return `void-${hash.slice(0, 8)}`;
}

/**
 * Sign a message with the server's secret key
 */
function signMessage(message, secretKeyBase58) {
  const secretKey = bs58.decode(secretKeyBase58);
  const messageBytes = Buffer.from(JSON.stringify(message));
  const signature = nacl.sign.detached(messageBytes, secretKey);
  return bs58.encode(signature);
}

/**
 * Verify a signed message from another server
 */
function verifySignature(message, signatureBase58, publicKeyBase58) {
  const signature = bs58.decode(signatureBase58);
  const publicKey = bs58.decode(publicKeyBase58);
  const messageBytes = Buffer.from(JSON.stringify(message));
  return nacl.sign.detached.verify(messageBytes, signature, publicKey);
}

/**
 * Encrypt a message for a specific peer using their public key
 * Uses ed2curve for proper Ed25519 to Curve25519 key conversion
 */
function encryptForPeer(message, peerPublicKeyBase58, ourSecretKeyBase58) {
  const peerPublicKey = bs58.decode(peerPublicKeyBase58);
  const ourSecretKey = bs58.decode(ourSecretKeyBase58);

  // Convert Ed25519 keys to Curve25519 for encryption
  const peerCurvePublicKey = ed2curve.convertPublicKey(peerPublicKey);
  const ourCurveSecretKey = ed2curve.convertSecretKey(ourSecretKey);

  if (!peerCurvePublicKey || !ourCurveSecretKey) {
    console.log('❌ Failed to convert keys for encryption');
    return null;
  }

  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = Buffer.from(JSON.stringify(message));
  const encrypted = nacl.box(messageBytes, nonce, peerCurvePublicKey, ourCurveSecretKey);

  return {
    nonce: bs58.encode(nonce),
    ciphertext: bs58.encode(encrypted)
  };
}

/**
 * Decrypt a message from a peer
 * Uses ed2curve for proper Ed25519 to Curve25519 key conversion
 */
function decryptFromPeer(encryptedData, peerPublicKeyBase58, ourSecretKeyBase58) {
  const peerPublicKey = bs58.decode(peerPublicKeyBase58);
  const ourSecretKey = bs58.decode(ourSecretKeyBase58);
  const nonce = bs58.decode(encryptedData.nonce);
  const ciphertext = bs58.decode(encryptedData.ciphertext);

  // Convert Ed25519 keys to Curve25519 for decryption
  const peerCurvePublicKey = ed2curve.convertPublicKey(peerPublicKey);
  const ourCurveSecretKey = ed2curve.convertSecretKey(ourSecretKey);

  if (!peerCurvePublicKey || !ourCurveSecretKey) {
    console.log('❌ Failed to convert keys for decryption');
    return null;
  }

  const decrypted = nacl.box.open(ciphertext, nonce, peerCurvePublicKey, ourCurveSecretKey);
  if (!decrypted) {
    return null;
  }

  return JSON.parse(Buffer.from(decrypted).toString());
}

/**
 * Generate a challenge for peer verification
 */
function generateChallenge() {
  return bs58.encode(nacl.randomBytes(32));
}

/**
 * Create a challenge response
 */
function respondToChallenge(challenge, secretKeyBase58) {
  return signMessage({ challenge, timestamp: Date.now() }, secretKeyBase58);
}

/**
 * Verify a challenge response
 */
function verifyChallengeResponse(challenge, response, publicKeyBase58, maxAgeMs = 60000) {
  const message = { challenge, timestamp: Date.now() };

  // Try to verify with various recent timestamps (within maxAgeMs)
  const now = Date.now();
  for (let offset = 0; offset <= maxAgeMs; offset += 1000) {
    message.timestamp = now - offset;
    if (verifySignature(message, response, publicKeyBase58)) {
      return true;
    }
  }
  return false;
}

class FederationService {
  constructor() {
    this.identity = null;
    this.peers = new Map();
    this.capabilities = [];
    this.dht = null;
  }

  /**
   * Initialize the federation service
   */
  initialize() {
    this.identity = loadIdentity();
    this.loadPeers();
    this.detectCapabilities();
    console.log(`🌐 Federation service initialized: ${this.identity.serverId}`);

    // Initialize DHT after a short delay (allows routes to be registered first)
    setTimeout(() => {
      this.initializeDHT();
    }, 1000);

    return this.identity;
  }

  /**
   * Initialize the DHT service
   */
  initializeDHT() {
    // Lazy require to avoid circular dependency
    const { getDHTService } = require('./dht-service');
    this.dht = getDHTService();
    this.dht.initialize(this);
  }

  /**
   * Get server manifest for federation
   */
  getManifest() {
    return {
      serverId: this.identity.serverId,
      publicKey: this.identity.publicKey,
      version: this.getVersion(),
      capabilities: this.capabilities,
      plugins: this.getPluginList(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get current version from package.json
   */
  getVersion() {
    const packagePath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return pkg.version;
  }

  /**
   * Get list of installed plugins
   */
  getPluginList() {
    const pluginsDir = path.resolve(__dirname, '../../plugins');
    const userPluginsDir = path.resolve(__dirname, '../../data/plugins');

    const plugins = [];

    if (fs.existsSync(pluginsDir)) {
      const corePlugins = fs.readdirSync(pluginsDir)
        .filter(name => name.startsWith('void-plugin-'))
        .map(name => ({ name, type: 'core' }));
      plugins.push(...corePlugins);
    }

    if (fs.existsSync(userPluginsDir)) {
      const userPlugins = fs.readdirSync(userPluginsDir)
        .filter(name => name.startsWith('void-plugin-'))
        .map(name => ({ name, type: 'user' }));
      plugins.push(...userPlugins);
    }

    return plugins;
  }

  /**
   * Detect server capabilities
   */
  detectCapabilities() {
    this.capabilities = ['memory', 'chat'];

    // Check for Neo4j
    const neo4jConfigPath = path.join(DATA_DIR, 'neo4j.json');
    if (fs.existsSync(neo4jConfigPath)) {
      this.capabilities.push('neo4j');
    }

    // Check for IPFS
    const ipfsConfigPath = path.join(DATA_DIR, 'ipfs.json');
    if (fs.existsSync(ipfsConfigPath)) {
      this.capabilities.push('ipfs');
    }

    // Check for wallet plugin
    const walletPluginPath = path.resolve(__dirname, '../../plugins/void-plugin-wallet');
    if (fs.existsSync(walletPluginPath)) {
      this.capabilities.push('wallet');
    }

    return this.capabilities;
  }

  /**
   * Load known peers from file
   */
  loadPeers() {
    ensureFederationDir();

    if (fs.existsSync(PEERS_PATH)) {
      const peersData = JSON.parse(fs.readFileSync(PEERS_PATH, 'utf8'));
      for (const peer of peersData) {
        this.peers.set(peer.serverId, peer);
      }
      console.log(`🌐 Loaded ${this.peers.size} known peers`);
    }
  }

  /**
   * Save peers to file
   */
  savePeers() {
    const peersArray = Array.from(this.peers.values());
    fs.writeFileSync(PEERS_PATH, JSON.stringify(peersArray, null, 2));
  }

  /**
   * Add or update a peer
   */
  addPeer(manifest, endpoint) {
    const isNew = !this.peers.has(manifest.serverId);
    const peer = {
      serverId: manifest.serverId,
      publicKey: manifest.publicKey,
      endpoint,
      version: manifest.version,
      capabilities: manifest.capabilities,
      plugins: manifest.plugins,
      trustLevel: 'unknown',
      lastSeen: new Date().toISOString(),
      addedAt: this.peers.has(manifest.serverId)
        ? this.peers.get(manifest.serverId).addedAt
        : new Date().toISOString(),
      healthScore: 1.0,
      failedChecks: 0
    };

    this.peers.set(manifest.serverId, peer);
    this.savePeers();
    console.log(`🌐 Added/updated peer: ${peer.serverId}`);

    // Save to Neo4j for persistent storage
    const peerService = getPeerServiceLazy();
    peerService.upsertPeer(peer).catch(err => {
      console.error(`🌐 Failed to save peer to Neo4j: ${err.message}`);
    });

    // Broadcast to connected clients
    broadcast('federation:peer-update', {
      type: isNew ? 'added' : 'updated',
      peer: {
        serverId: peer.serverId,
        endpoint: peer.endpoint,
        capabilities: peer.capabilities,
        trustLevel: peer.trustLevel
      }
    });

    return peer;
  }

  /**
   * Get a peer by server ID
   */
  getPeer(serverId) {
    return this.peers.get(serverId);
  }

  /**
   * Get all peers
   */
  getAllPeers() {
    return Array.from(this.peers.values());
  }

  /**
   * Remove a peer
   */
  removePeer(serverId) {
    const removed = this.peers.delete(serverId);
    if (removed) {
      this.savePeers();
      console.log(`🌐 Removed peer: ${serverId}`);
    }
    return removed;
  }

  /**
   * Update peer trust level after verification
   */
  setTrustLevel(serverId, trustLevel) {
    const peer = this.peers.get(serverId);
    if (peer) {
      peer.trustLevel = trustLevel;
      peer.verifiedAt = new Date().toISOString();
      this.savePeers();
      console.log(`🌐 Set trust level for ${serverId}: ${trustLevel}`);
    }
    return peer;
  }

  /**
   * Update peer health after check
   */
  updatePeerHealth(serverId, isHealthy) {
    const peer = this.peers.get(serverId);
    if (peer) {
      if (isHealthy) {
        peer.lastSeen = new Date().toISOString();
        peer.failedChecks = 0;
        peer.healthScore = Math.min(1.0, peer.healthScore + 0.1);
      } else {
        peer.failedChecks = (peer.failedChecks || 0) + 1;
        peer.healthScore = Math.max(0, peer.healthScore - 0.2);
      }
      this.savePeers();
    }
    return peer;
  }

  /**
   * Sign a message for sending to peers
   */
  sign(message) {
    return signMessage(message, this.identity.secretKey);
  }

  /**
   * Verify a message from a peer
   */
  verify(message, signature, publicKey) {
    return verifySignature(message, signature, publicKey);
  }

  /**
   * Encrypt a message for a specific peer
   */
  encrypt(message, peerPublicKey) {
    return encryptForPeer(message, peerPublicKey, this.identity.secretKey);
  }

  /**
   * Decrypt a message from a peer
   */
  decrypt(encryptedData, peerPublicKey) {
    return decryptFromPeer(encryptedData, peerPublicKey, this.identity.secretKey);
  }

  /**
   * Generate a verification challenge
   */
  createChallenge() {
    return generateChallenge();
  }

  /**
   * Respond to a verification challenge
   */
  answerChallenge(challenge) {
    return respondToChallenge(challenge, this.identity.secretKey);
  }

  /**
   * Verify a challenge response from a peer
   */
  verifyChallenge(challenge, response, peerPublicKey) {
    return verifyChallengeResponse(challenge, response, peerPublicKey);
  }

  /**
   * Send a secure (encrypted + signed) message to a peer
   * @param {string} serverId - The target peer's server ID
   * @param {object} message - The message to send
   * @returns {Promise<object>} - The peer's response
   */
  async sendSecureMessage(serverId, message) {
    const peer = this.peers.get(serverId);
    if (!peer) {
      return { success: false, error: 'Peer not found' };
    }

    // Add metadata to message
    const fullMessage = {
      ...message,
      from: this.identity.serverId,
      timestamp: Date.now()
    };

    // Encrypt the message for the peer
    const encrypted = this.encrypt(fullMessage, peer.publicKey);
    if (!encrypted) {
      return { success: false, error: 'Encryption failed' };
    }

    // Sign the encrypted message
    const signature = this.sign(encrypted);

    // Send to peer
    const url = `${peer.endpoint.replace(/\/$/, '')}/api/federation/message`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromServerId: this.identity.serverId,
        encrypted,
        signature
      }),
      signal: AbortSignal.timeout(30000)
    }).catch(err => ({ ok: false, error: err.message }));

    if (!response.ok) {
      this.updatePeerHealth(serverId, false);
      return { success: false, error: response.error || response.statusText };
    }

    this.updatePeerHealth(serverId, true);
    return await response.json();
  }

  /**
   * Perform mutual verification with a peer using challenge-response
   * @param {string} serverId - The target peer's server ID
   * @returns {Promise<object>} - Verification result
   */
  async verifyPeer(serverId) {
    const peer = this.peers.get(serverId);
    if (!peer) {
      return { success: false, error: 'Peer not found' };
    }

    // Step 1: Request a challenge from the peer
    const challengeUrl = `${peer.endpoint.replace(/\/$/, '')}/api/federation/verify/challenge`;
    const challengeResponse = await fetch(challengeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000)
    }).catch(err => ({ ok: false, error: err.message }));

    if (!challengeResponse.ok) {
      return { success: false, error: 'Failed to get challenge from peer' };
    }

    const { challenge, publicKey } = await challengeResponse.json();

    // Verify the public key matches what we have
    if (publicKey !== peer.publicKey) {
      return { success: false, error: 'Public key mismatch' };
    }

    // Step 2: Create our response to their challenge
    const ourResponse = this.answerChallenge(challenge);

    // Step 3: Send our response back for verification
    const verifyUrl = `${peer.endpoint.replace(/\/$/, '')}/api/federation/verify/respond`;
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge,
        response: ourResponse,
        serverId: this.identity.serverId,
        publicKey: this.identity.publicKey
      }),
      signal: AbortSignal.timeout(10000)
    }).catch(err => ({ ok: false, error: err.message }));

    if (!verifyResponse.ok) {
      return { success: false, error: 'Verification failed' };
    }

    // Update trust level
    this.setTrustLevel(serverId, 'verified');
    this.updatePeerHealth(serverId, true);

    return { success: true, verified: true, serverId };
  }
}

// Singleton instance
let instance = null;

function getFederationService() {
  if (!instance) {
    instance = new FederationService();
    instance.initialize();
  }
  return instance;
}

module.exports = {
  FederationService,
  getFederationService,
  signMessage,
  verifySignature,
  generateChallenge,
  respondToChallenge
};
