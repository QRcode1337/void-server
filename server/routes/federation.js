/**
 * Federation API Routes
 *
 * Provides REST endpoints for server-to-server federation:
 * - Server manifest/discovery
 * - Peer management
 * - Challenge-response verification
 * - Secure messaging
 */

const express = require('express');
const router = express.Router();
const { getFederationService } = require('../services/federation-service');
const { getDHTService } = require('../services/dht-service');
const { getPeerService } = require('../services/peer-service');

// GET /api/federation/manifest - Get this server's public manifest
router.get('/manifest', (req, res) => {
  console.log(`🌐 GET /api/federation/manifest`);

  const federation = getFederationService();
  const manifest = federation.getManifest();

  res.json({
    success: true,
    manifest
  });
});

// GET /api/federation/identity - Get server identity (public info only)
router.get('/identity', (req, res) => {
  console.log(`🌐 GET /api/federation/identity`);

  const federation = getFederationService();

  res.json({
    success: true,
    serverId: federation.identity.serverId,
    publicKey: federation.identity.publicKey,
    createdAt: federation.identity.createdAt
  });
});

// GET /api/federation/peers - List all known peers
router.get('/peers', (req, res) => {
  console.log(`🌐 GET /api/federation/peers`);

  const federation = getFederationService();
  const peers = federation.getAllPeers();

  res.json({
    success: true,
    count: peers.length,
    peers: peers.map(peer => ({
      serverId: peer.serverId,
      publicKey: peer.publicKey,
      endpoint: peer.endpoint,
      version: peer.version,
      capabilities: peer.capabilities,
      trustLevel: peer.trustLevel,
      healthScore: peer.healthScore,
      lastSeen: peer.lastSeen
    }))
  });
});

// POST /api/federation/peers - Add a new peer
router.post('/peers', async (req, res) => {
  const { endpoint } = req.body;
  console.log(`🌐 POST /api/federation/peers endpoint=${endpoint}`);

  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'endpoint required' });
  }

  // Fetch manifest from peer
  const manifestUrl = `${endpoint.replace(/\/$/, '')}/api/federation/manifest`;

  const response = await fetch(manifestUrl, {
    headers: { 'Accept': 'application/json' },
    timeout: 10000
  }).catch(err => ({ ok: false, error: err.message }));

  if (!response.ok) {
    console.log(`❌ Failed to fetch peer manifest: ${response.error || response.statusText}`);
    return res.status(400).json({
      success: false,
      error: `Could not reach peer at ${endpoint}`
    });
  }

  const data = await response.json();

  if (!data.success || !data.manifest) {
    return res.status(400).json({
      success: false,
      error: 'Invalid manifest response from peer'
    });
  }

  const federation = getFederationService();
  const peer = federation.addPeer(data.manifest, endpoint);

  console.log(`✅ Added peer: ${peer.serverId}`);

  res.json({
    success: true,
    peer: {
      serverId: peer.serverId,
      publicKey: peer.publicKey,
      endpoint: peer.endpoint,
      version: peer.version,
      capabilities: peer.capabilities,
      trustLevel: peer.trustLevel
    }
  });
});

// DELETE /api/federation/peers/:serverId - Remove a peer
router.delete('/peers/:serverId', (req, res) => {
  const { serverId } = req.params;
  console.log(`🌐 DELETE /api/federation/peers/${serverId}`);

  const federation = getFederationService();
  const removed = federation.removePeer(serverId);

  if (!removed) {
    return res.status(404).json({ success: false, error: 'Peer not found' });
  }

  res.json({ success: true, message: `Peer ${serverId} removed` });
});

// POST /api/federation/verify/challenge - Generate a challenge for a peer
router.post('/verify/challenge', (req, res) => {
  console.log(`🌐 POST /api/federation/verify/challenge`);

  const federation = getFederationService();
  const challenge = federation.createChallenge();

  res.json({
    success: true,
    challenge,
    serverId: federation.identity.serverId,
    publicKey: federation.identity.publicKey
  });
});

// POST /api/federation/verify/respond - Respond to a challenge from another server
router.post('/verify/respond', (req, res) => {
  const { challenge } = req.body;
  console.log(`🌐 POST /api/federation/verify/respond`);

  if (!challenge) {
    return res.status(400).json({ success: false, error: 'challenge required' });
  }

  const federation = getFederationService();
  const response = federation.answerChallenge(challenge);

  res.json({
    success: true,
    response,
    serverId: federation.identity.serverId,
    publicKey: federation.identity.publicKey
  });
});

// POST /api/federation/verify/complete - Verify a peer's challenge response
router.post('/verify/complete', (req, res) => {
  const { serverId, challenge, response } = req.body;
  console.log(`🌐 POST /api/federation/verify/complete serverId=${serverId}`);

  if (!serverId || !challenge || !response) {
    return res.status(400).json({ success: false, error: 'serverId, challenge, and response required' });
  }

  const federation = getFederationService();
  const peer = federation.getPeer(serverId);

  if (!peer) {
    return res.status(404).json({ success: false, error: 'Peer not found' });
  }

  const isValid = federation.verifyChallenge(challenge, response, peer.publicKey);

  if (isValid) {
    federation.setTrustLevel(serverId, 'verified');
    console.log(`✅ Peer ${serverId} verified`);
  } else {
    console.log(`❌ Peer ${serverId} verification failed`);
  }

  res.json({
    success: isValid,
    verified: isValid,
    trustLevel: isValid ? 'verified' : peer.trustLevel
  });
});

// POST /api/federation/message - Receive an encrypted message from a peer
router.post('/message', async (req, res) => {
  const { fromServerId, encrypted, signature } = req.body;
  console.log(`🌐 POST /api/federation/message from=${fromServerId}`);

  if (!fromServerId || !encrypted || !signature) {
    return res.status(400).json({ success: false, error: 'fromServerId, encrypted, and signature required' });
  }

  const federation = getFederationService();
  const peer = federation.getPeer(fromServerId);

  if (!peer) {
    return res.status(404).json({ success: false, error: 'Unknown peer' });
  }

  // Verify signature
  if (!federation.verify(encrypted, signature, peer.publicKey)) {
    console.log(`❌ Invalid signature from ${fromServerId}`);
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  // Decrypt message
  const message = federation.decrypt(encrypted, peer.publicKey);

  if (!message) {
    console.log(`❌ Failed to decrypt message from ${fromServerId}`);
    return res.status(400).json({ success: false, error: 'Decryption failed' });
  }

  console.log(`✅ Received message from ${fromServerId}: ${message.type || 'unknown type'}`);

  // Handle different message types
  const response = await handleFederationMessage(message, peer, federation);

  res.json({
    success: true,
    response
  });
});

// POST /api/federation/ping - Simple health check from a peer
router.post('/ping', (req, res) => {
  const { fromServerId } = req.body;
  console.log(`🌐 POST /api/federation/ping from=${fromServerId || 'unknown'}`);

  const federation = getFederationService();

  if (fromServerId) {
    federation.updatePeerHealth(fromServerId, true);
  }

  res.json({
    success: true,
    serverId: federation.identity.serverId,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// POST /api/federation/secure-message - Send a secure message to a peer
router.post('/secure-message', async (req, res) => {
  const { serverId, message } = req.body;
  console.log(`🌐 POST /api/federation/secure-message to=${serverId}`);

  if (!serverId || !message) {
    return res.status(400).json({ success: false, error: 'serverId and message required' });
  }

  const federation = getFederationService();
  const result = await federation.sendSecureMessage(serverId, message);

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// POST /api/federation/verify-peer - Perform mutual verification with a peer
router.post('/verify-peer', async (req, res) => {
  const { serverId } = req.body;
  console.log(`🌐 POST /api/federation/verify-peer serverId=${serverId}`);

  if (!serverId) {
    return res.status(400).json({ success: false, error: 'serverId required' });
  }

  const federation = getFederationService();
  const result = await federation.verifyPeer(serverId);

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// POST /api/federation/test-crypto - Test encryption/decryption (for debugging)
router.post('/test-crypto', (req, res) => {
  console.log(`🌐 POST /api/federation/test-crypto`);

  const federation = getFederationService();

  // Test self-encryption/decryption
  const testMessage = {
    type: 'test',
    data: 'Hello, secure world!',
    timestamp: Date.now()
  };

  // Encrypt for ourselves (using our own public key)
  const encrypted = federation.encrypt(testMessage, federation.identity.publicKey);
  if (!encrypted) {
    return res.status(500).json({ success: false, error: 'Encryption failed' });
  }

  // Decrypt
  const decrypted = federation.decrypt(encrypted, federation.identity.publicKey);
  if (!decrypted) {
    return res.status(500).json({ success: false, error: 'Decryption failed' });
  }

  // Verify the message matches
  const matches = JSON.stringify(testMessage) === JSON.stringify(decrypted);

  // Test signing
  const signature = federation.sign(testMessage);
  const verified = federation.verify(testMessage, signature, federation.identity.publicKey);

  res.json({
    success: true,
    encryption: {
      original: testMessage,
      encrypted: { nonce: encrypted.nonce.slice(0, 16) + '...', ciphertext: encrypted.ciphertext.slice(0, 16) + '...' },
      decrypted,
      matches
    },
    signing: {
      signature: signature.slice(0, 16) + '...',
      verified
    }
  });
});

// ============ DHT Routes ============

/**
 * Ensure DHT is initialized before use
 */
function ensureDHTInitialized() {
  const federation = getFederationService();
  const dht = getDHTService();

  if (!dht.nodeId) {
    dht.initialize(federation);
  }

  return dht;
}

// GET /api/federation/dht/status - Get DHT status
router.get('/dht/status', (req, res) => {
  console.log(`🌐 GET /api/federation/dht/status`);

  const dht = ensureDHTInitialized();
  const status = dht.getStatus();

  res.json({
    success: true,
    ...status
  });
});

// GET /api/federation/dht/nodes - Get all DHT nodes
router.get('/dht/nodes', (req, res) => {
  console.log(`🌐 GET /api/federation/dht/nodes`);

  const dht = ensureDHTInitialized();
  const nodes = dht.getNodes();

  res.json({
    success: true,
    count: nodes.length,
    nodes
  });
});

// POST /api/federation/dht/bootstrap - Bootstrap the DHT
router.post('/dht/bootstrap', async (req, res) => {
  console.log(`🌐 POST /api/federation/dht/bootstrap`);

  const dht = ensureDHTInitialized();
  const result = await dht.bootstrap();

  res.json(result);
});

// POST /api/federation/dht/announce - Announce this node to the network
router.post('/dht/announce', async (req, res) => {
  const { nodeId, endpoint, publicKey, serverId, capabilities } = req.body;

  // If called without body, announce ourselves
  if (!nodeId) {
    console.log(`🌐 POST /api/federation/dht/announce (self)`);
    const dht = ensureDHTInitialized();
    const result = await dht.announce();
    return res.json(result);
  }

  // Otherwise, handle incoming announcement from peer
  console.log(`🌐 POST /api/federation/dht/announce from=${serverId}`);

  if (!endpoint || !publicKey) {
    return res.status(400).json({ success: false, error: 'endpoint and publicKey required' });
  }

  const dht = ensureDHTInitialized();
  const added = dht.handleAnnounce(nodeId, endpoint, publicKey, serverId, capabilities);

  res.json({
    success: true,
    added,
    nodeId: dht.nodeId
  });
});

// POST /api/federation/dht/find-node - Find nodes close to a target ID
router.post('/dht/find-node', (req, res) => {
  const { targetId, fromNodeId, fromEndpoint, fromPublicKey, fromServerId } = req.body;
  console.log(`🌐 POST /api/federation/dht/find-node target=${targetId?.slice(0, 16)}...`);

  if (!targetId) {
    return res.status(400).json({ success: false, error: 'targetId required' });
  }

  const dht = ensureDHTInitialized();
  const nodes = dht.handleFindNode(targetId, fromNodeId, fromEndpoint, fromPublicKey, fromServerId);

  res.json({
    success: true,
    nodes
  });
});

// POST /api/federation/dht/bootstrap-nodes - Add a bootstrap node
router.post('/dht/bootstrap-nodes', (req, res) => {
  const { endpoint, name } = req.body;
  console.log(`🌐 POST /api/federation/dht/bootstrap-nodes endpoint=${endpoint}`);

  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'endpoint required' });
  }

  const dht = ensureDHTInitialized();
  dht.addBootstrapNode(endpoint, name);

  res.json({
    success: true,
    bootstrapNodes: dht.bootstrapNodes
  });
});

// GET /api/federation/dht/bootstrap-nodes - Get bootstrap nodes
router.get('/dht/bootstrap-nodes', (req, res) => {
  console.log(`🌐 GET /api/federation/dht/bootstrap-nodes`);

  const dht = ensureDHTInitialized();

  res.json({
    success: true,
    bootstrapNodes: dht.bootstrapNodes
  });
});

// ============ Neo4j Peer Management ============

/**
 * Ensure peer service is initialized
 */
function ensurePeerServiceInitialized() {
  const federation = getFederationService();
  const peerService = getPeerService();

  if (!peerService.federationService) {
    peerService.initialize(federation);
  }

  return peerService;
}

// POST /api/federation/peers/neo4j - Add/update a peer in Neo4j
router.post('/peers/neo4j', async (req, res) => {
  const { serverId, publicKey, endpoint, version, capabilities, plugins, trustLevel } = req.body;
  console.log(`🌐 POST /api/federation/peers/neo4j serverId=${serverId}`);

  if (!serverId || !publicKey || !endpoint) {
    return res.status(400).json({ success: false, error: 'serverId, publicKey, and endpoint required' });
  }

  const peerService = ensurePeerServiceInitialized();
  const peer = await peerService.upsertPeer({
    serverId,
    publicKey,
    endpoint,
    version,
    capabilities: capabilities || [],
    plugins: plugins || [],
    trustLevel: trustLevel || 'unknown'
  });

  if (!peer) {
    return res.status(500).json({ success: false, error: 'Failed to add peer - Neo4j may be unavailable' });
  }

  res.json({
    success: true,
    peer: await peerService.getPeer(serverId)
  });
});

// DELETE /api/federation/peers/neo4j/:serverId - Delete a peer from Neo4j
router.delete('/peers/neo4j/:serverId', async (req, res) => {
  const { serverId } = req.params;
  console.log(`🌐 DELETE /api/federation/peers/neo4j/${serverId}`);

  const peerService = ensurePeerServiceInitialized();
  const deleted = await peerService.deletePeer(serverId);

  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Peer not found' });
  }

  res.json({
    success: true,
    message: `Peer ${serverId} deleted`
  });
});

// GET /api/federation/peers/neo4j - Get all peers from Neo4j
router.get('/peers/neo4j', async (req, res) => {
  console.log(`🌐 GET /api/federation/peers/neo4j`);

  const peerService = ensurePeerServiceInitialized();
  const peers = await peerService.getAllPeers({
    excludeBlocked: req.query.includeBlocked !== 'true'
  });

  res.json({
    success: true,
    count: peers.length,
    peers
  });
});

// GET /api/federation/peers/neo4j/healthy - Get healthy peers
router.get('/peers/neo4j/healthy', async (req, res) => {
  console.log(`🌐 GET /api/federation/peers/neo4j/healthy`);

  const minHealth = parseFloat(req.query.minHealth) || 0.5;
  const peerService = ensurePeerServiceInitialized();
  const peers = await peerService.getHealthyPeers(minHealth);

  res.json({
    success: true,
    count: peers.length,
    peers
  });
});

// GET /api/federation/peers/neo4j/trusted - Get trusted peers
router.get('/peers/neo4j/trusted', async (req, res) => {
  console.log(`🌐 GET /api/federation/peers/neo4j/trusted`);

  const peerService = ensurePeerServiceInitialized();
  const peers = await peerService.getTrustedPeers();

  res.json({
    success: true,
    count: peers.length,
    peers
  });
});

// GET /api/federation/peers/neo4j/stats - Get peer statistics
router.get('/peers/neo4j/stats', async (req, res) => {
  console.log(`🌐 GET /api/federation/peers/neo4j/stats`);

  const peerService = ensurePeerServiceInitialized();
  const stats = await peerService.getStats();

  res.json({
    success: true,
    stats
  });
});

// GET /api/federation/peers/neo4j/graph - Get trust graph for visualization
router.get('/peers/neo4j/graph', async (req, res) => {
  console.log(`🌐 GET /api/federation/peers/neo4j/graph`);

  const peerService = ensurePeerServiceInitialized();
  const graph = await peerService.getTrustGraph();

  res.json({
    success: true,
    ...graph
  });
});

// GET /api/federation/peers/neo4j/:serverId - Get a specific peer
router.get('/peers/neo4j/:serverId', async (req, res) => {
  const { serverId } = req.params;
  console.log(`🌐 GET /api/federation/peers/neo4j/${serverId}`);

  const peerService = ensurePeerServiceInitialized();
  const peer = await peerService.getPeer(serverId);

  if (!peer) {
    return res.status(404).json({ success: false, error: 'Peer not found' });
  }

  res.json({
    success: true,
    peer
  });
});

// GET /api/federation/peers/neo4j/:serverId/trust-score - Get peer trust score
router.get('/peers/neo4j/:serverId/trust-score', async (req, res) => {
  const { serverId } = req.params;
  console.log(`🌐 GET /api/federation/peers/neo4j/${serverId}/trust-score`);

  const peerService = ensurePeerServiceInitialized();
  const trustScore = await peerService.calculateTrustScore(serverId);

  res.json({
    success: true,
    serverId,
    trustScore
  });
});

// PUT /api/federation/peers/neo4j/:serverId/trust - Update peer trust level
router.put('/peers/neo4j/:serverId/trust', async (req, res) => {
  const { serverId } = req.params;
  const { trustLevel } = req.body;
  console.log(`🌐 PUT /api/federation/peers/neo4j/${serverId}/trust level=${trustLevel}`);

  if (!trustLevel) {
    return res.status(400).json({ success: false, error: 'trustLevel required' });
  }

  const peerService = ensurePeerServiceInitialized();
  const peer = await peerService.setTrustLevel(serverId, trustLevel);

  if (!peer) {
    return res.status(404).json({ success: false, error: 'Peer not found or invalid trust level' });
  }

  // Also update in-memory federation service
  const federation = getFederationService();
  federation.setTrustLevel(serverId, trustLevel);

  res.json({
    success: true,
    peer
  });
});

// POST /api/federation/peers/neo4j/:serverId/block - Block a peer
router.post('/peers/neo4j/:serverId/block', async (req, res) => {
  const { serverId } = req.params;
  const { reason } = req.body;
  console.log(`🌐 POST /api/federation/peers/neo4j/${serverId}/block`);

  const peerService = ensurePeerServiceInitialized();
  const peer = await peerService.blockPeer(serverId, reason);

  if (!peer) {
    return res.status(404).json({ success: false, error: 'Peer not found' });
  }

  res.json({
    success: true,
    peer
  });
});

// POST /api/federation/peers/neo4j/:serverId/unblock - Unblock a peer
router.post('/peers/neo4j/:serverId/unblock', async (req, res) => {
  const { serverId } = req.params;
  console.log(`🌐 POST /api/federation/peers/neo4j/${serverId}/unblock`);

  const peerService = ensurePeerServiceInitialized();
  const peer = await peerService.unblockPeer(serverId);

  if (!peer) {
    return res.status(404).json({ success: false, error: 'Peer not found' });
  }

  res.json({
    success: true,
    peer
  });
});

// POST /api/federation/peers/neo4j/:serverId/trust-relationship - Create trust relationship
router.post('/peers/neo4j/:serverId/trust-relationship', async (req, res) => {
  const { serverId } = req.params;
  const { targetServerId } = req.body;
  console.log(`🌐 POST /api/federation/peers/neo4j/${serverId}/trust-relationship -> ${targetServerId}`);

  if (!targetServerId) {
    return res.status(400).json({ success: false, error: 'targetServerId required' });
  }

  const peerService = ensurePeerServiceInitialized();
  const created = await peerService.createTrustRelationship(serverId, targetServerId);

  res.json({
    success: created,
    from: serverId,
    to: targetServerId
  });
});

// POST /api/federation/peers/neo4j/sync - Sync peers from memory to Neo4j
router.post('/peers/neo4j/sync', async (req, res) => {
  console.log(`🌐 POST /api/federation/peers/neo4j/sync`);

  const peerService = ensurePeerServiceInitialized();
  await peerService.syncFromFederationService();

  const peers = await peerService.getAllPeers();

  res.json({
    success: true,
    synced: peers.length
  });
});

// POST /api/federation/peers/neo4j/health-check - Run health checks
router.post('/peers/neo4j/health-check', async (req, res) => {
  console.log(`🌐 POST /api/federation/peers/neo4j/health-check`);

  const peerService = ensurePeerServiceInitialized();
  await peerService.runHealthChecks();

  const stats = await peerService.getStats();

  res.json({
    success: true,
    stats
  });
});

// ============ Token Gate Routes ============

const tokenGate = require('../services/token-gate-service');

// GET /api/federation/token-gate/config - Get token gate configuration
router.get('/token-gate/config', (req, res) => {
  console.log(`🌐 GET /api/federation/token-gate/config`);
  res.json({
    success: true,
    config: tokenGate.getConfig()
  });
});

// GET /api/federation/token-gate/check - Check wallet access level
router.get('/token-gate/check', async (req, res) => {
  const { wallet, feature } = req.query;
  console.log(`🌐 GET /api/federation/token-gate/check wallet=${wallet?.slice(0, 8)}... feature=${feature || 'none'}`);

  if (!wallet) {
    return res.status(400).json({ success: false, error: 'wallet query param required' });
  }

  if (!tokenGate.isValidWallet(wallet)) {
    return res.status(400).json({ success: false, error: 'Invalid wallet address format' });
  }

  const balance = await tokenGate.getClawedBalance(wallet);
  const tier = tokenGate.getTierForBalance(balance);

  const result = {
    success: true,
    wallet,
    balance,
    tier,
    token: tokenGate.CLAWED_TOKEN
  };

  // If feature specified, check access
  if (feature) {
    const access = await tokenGate.checkAccess(wallet, feature);
    result.feature = feature;
    result.allowed = access.allowed;
    result.required = access.required;
    result.requiredTier = access.requiredTier;
  }

  res.json(result);
});

// POST /api/federation/token-gate/clear-cache - Clear balance cache
router.post('/token-gate/clear-cache', (req, res) => {
  const { wallet } = req.body;
  console.log(`🌐 POST /api/federation/token-gate/clear-cache wallet=${wallet || 'all'}`);

  tokenGate.clearCache(wallet);

  res.json({ success: true, cleared: wallet || 'all' });
});

// ============ Memory Sync Routes ============

const { getMemorySyncService } = require('../services/memory-sync-service');

/**
 * Ensure memory sync service is initialized
 */
function ensureMemorySyncServiceInitialized() {
  return getMemorySyncService();
}

// POST /api/federation/memories/export - Export memories with filters
router.post('/memories/export', async (req, res) => {
  const { category, stage, tags, minImportance, since, limit, requesterId } = req.body;
  console.log(`🌐 POST /api/federation/memories/export requesterId=${requesterId || 'local'}`);

  const syncService = ensureMemorySyncServiceInitialized();
  const exportData = await syncService.exportMemories({
    category,
    stage,
    tags,
    minImportance,
    since,
    limit
  });

  res.json({
    success: true,
    data: exportData
  });
});

// POST /api/federation/memories/import - Import memories from a peer export
router.post('/memories/import', async (req, res) => {
  const { exportData, skipDuplicates, dryRun } = req.body;
  console.log(`🌐 POST /api/federation/memories/import dryRun=${dryRun || false}`);

  if (!exportData || !exportData.manifest || !exportData.memories) {
    return res.status(400).json({ success: false, error: 'exportData with manifest and memories required' });
  }

  const syncService = ensureMemorySyncServiceInitialized();
  const result = await syncService.importMemories(exportData, {
    skipDuplicates: skipDuplicates !== false,
    dryRun: dryRun || false
  });

  res.json(result);
});

// GET /api/federation/memories/sync/stats - Get memory sync statistics
router.get('/memories/sync/stats', async (req, res) => {
  console.log(`🌐 GET /api/federation/memories/sync/stats`);

  const syncService = ensureMemorySyncServiceInitialized();
  const stats = await syncService.getStats();

  res.json({
    success: true,
    stats
  });
});

// GET /api/federation/memories/sync/states - Get all sync states
router.get('/memories/sync/states', async (req, res) => {
  console.log(`🌐 GET /api/federation/memories/sync/states`);

  const syncService = ensureMemorySyncServiceInitialized();
  const states = await syncService.getAllSyncStates();

  res.json({
    success: true,
    states
  });
});

// GET /api/federation/memories/sync/:peerId - Get sync state for a specific peer
router.get('/memories/sync/:peerId', async (req, res) => {
  const { peerId } = req.params;
  console.log(`🌐 GET /api/federation/memories/sync/${peerId}`);

  const syncService = ensureMemorySyncServiceInitialized();
  const state = await syncService.getSyncState(peerId);

  res.json({
    success: true,
    peerId,
    state
  });
});

// POST /api/federation/memories/sync/:peerId - Perform delta sync with a peer
router.post('/memories/sync/:peerId', async (req, res) => {
  const { peerId } = req.params;
  console.log(`🌐 POST /api/federation/memories/sync/${peerId}`);

  const syncService = ensureMemorySyncServiceInitialized();
  const federation = getFederationService();
  const peer = federation.getPeer(peerId);

  if (!peer) {
    return res.status(404).json({ success: false, error: 'Peer not found' });
  }

  const result = await syncService.deltaSync(peerId);
  res.json(result);
});

// POST /api/federation/memories/sync/:peerId/preview - Preview what would be imported
router.post('/memories/sync/:peerId/preview', async (req, res) => {
  const { peerId } = req.params;
  const { category, stage, tags, minImportance } = req.body;
  console.log(`🌐 POST /api/federation/memories/sync/${peerId}/preview`);

  const syncService = ensureMemorySyncServiceInitialized();
  const result = await syncService.previewImport(peerId, {
    category,
    stage,
    tags,
    minImportance
  });

  res.json(result);
});

// ============ Token-Gated Memory Routes ============
// These endpoints require $CLAWED token holdings for access

// POST /api/federation/gated/memories/export - Token-gated memory export
router.post('/gated/memories/export',
  tokenGate.requireTokens('federation:read_memories'),
  async (req, res) => {
    const { category, stage, tags, minImportance, since, limit } = req.body;
    console.log(`🌐 POST /api/federation/gated/memories/export tier=${req.tokenGate.tier}`);

    const syncService = ensureMemorySyncServiceInitialized();
    const exportData = await syncService.exportMemories({
      category,
      stage,
      tags,
      minImportance,
      since,
      limit
    });

    res.json({
      success: true,
      tokenGate: req.tokenGate,
      data: exportData
    });
  }
);

// POST /api/federation/gated/memories/import - Token-gated memory import
router.post('/gated/memories/import',
  tokenGate.requireTokens('federation:write_memories'),
  async (req, res) => {
    const { exportData, skipDuplicates, dryRun } = req.body;
    console.log(`🌐 POST /api/federation/gated/memories/import tier=${req.tokenGate.tier}`);

    if (!exportData || !exportData.manifest || !exportData.memories) {
      return res.status(400).json({ success: false, error: 'exportData with manifest and memories required' });
    }

    const syncService = ensureMemorySyncServiceInitialized();
    const result = await syncService.importMemories(exportData, {
      skipDuplicates: skipDuplicates !== false,
      dryRun: dryRun || false
    });

    res.json({
      ...result,
      tokenGate: req.tokenGate
    });
  }
);

// POST /api/federation/gated/memories/sync/:peerId - Token-gated delta sync
router.post('/gated/memories/sync/:peerId',
  tokenGate.requireTokens('federation:sync_peers'),
  async (req, res) => {
    const { peerId } = req.params;
    console.log(`🌐 POST /api/federation/gated/memories/sync/${peerId} tier=${req.tokenGate.tier}`);

    const syncService = ensureMemorySyncServiceInitialized();
    const federation = getFederationService();
    const peer = federation.getPeer(peerId);

    if (!peer) {
      return res.status(404).json({ success: false, error: 'Peer not found' });
    }

    const result = await syncService.deltaSync(peerId);
    res.json({
      ...result,
      tokenGate: req.tokenGate
    });
  }
);

// ============ Status ============

// GET /api/federation/status - Get federation status
router.get('/status', async (req, res) => {
  console.log(`🌐 GET /api/federation/status`);

  const federation = getFederationService();
  const peers = federation.getAllPeers();

  const trustedCount = peers.filter(p => p.trustLevel === 'trusted').length;
  const verifiedCount = peers.filter(p => p.trustLevel === 'verified').length;
  const healthyCount = peers.filter(p => p.healthScore > 0.5).length;

  // Get DHT status if initialized
  let dhtStatus = null;
  if (federation.dht) {
    dhtStatus = federation.dht.getStatus();
  }

  // Get Neo4j peer stats if available
  let neo4jPeerStats = null;
  const peerService = getPeerService();
  if (peerService.federationService) {
    neo4jPeerStats = await peerService.getStats().catch(() => null);
  }

  res.json({
    success: true,
    status: {
      serverId: federation.identity.serverId,
      publicKey: federation.identity.publicKey,
      capabilities: federation.capabilities,
      peers: {
        memory: {
          total: peers.length,
          trusted: trustedCount,
          verified: verifiedCount,
          healthy: healthyCount
        },
        neo4j: neo4jPeerStats
      },
      dht: dhtStatus,
      uptime: process.uptime()
    }
  });
});

/**
 * Handle incoming federation messages
 */
async function handleFederationMessage(message, peer, federation) {
  const syncService = getMemorySyncService();

  switch (message.type) {
    case 'memory_query': {
      // Handle memory export request from peer
      const exportData = await syncService.exportMemories(message.filters || {});
      return {
        type: 'memory_query_response',
        success: true,
        data: exportData
      };
    }

    case 'memory_share': {
      // Handle memory import from peer
      if (!message.exportData) {
        return { type: 'memory_share_response', success: false, error: 'No export data provided' };
      }
      const result = await syncService.importMemories(message.exportData, {
        skipDuplicates: true,
        dryRun: message.dryRun || false
      });
      return {
        type: 'memory_share_response',
        ...result
      };
    }

    case 'capability_check':
      return {
        type: 'capability_response',
        capabilities: federation.capabilities
      };

    default:
      return { type: 'unknown', status: 'unrecognized_message_type' };
  }
}

module.exports = router;
