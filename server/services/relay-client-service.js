/**
 * Relay Client Service
 *
 * WebSocket client that connects to void-mud relay hub.
 * Enables communication with other void-server peers without PUBLIC_URL.
 */

const { io } = require('socket.io-client');
const { broadcast } = require('../utils/broadcast');
const { getPeerService } = require('./peer-service');

// Default relay URL
const DEFAULT_RELAY_URL = 'https://void-mud.onrender.com';

// Chunk size for large payloads (64KB)
const CHUNK_SIZE = 64 * 1024;

class RelayClientService {
  constructor() {
    this.socket = null;
    this.relayUrl = null;
    this.federationService = null;
    this.connectedPeers = new Map(); // serverId -> manifest
    this.pendingMessages = new Map(); // messageId -> { resolve, reject, timeout }
    this.messageHandlers = new Map(); // type -> handler function
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  /**
   * Initialize with federation service
   */
  initialize(federationService) {
    this.federationService = federationService;
    this.relayUrl = process.env.RELAY_URL || DEFAULT_RELAY_URL;

    // Don't connect if in DHT-only mode
    if (process.env.FEDERATION_MODE === 'dht') {
      console.log('🌐 Relay: Skipped (FEDERATION_MODE=dht)');
      return;
    }

    this.connect();
  }

  /**
   * Connect to relay hub
   */
  connect() {
    if (this.socket?.connected) return;

    const relayWsUrl = this.relayUrl.replace(/^http/, 'ws');
    console.log(`🌐 Relay: Connecting to ${this.relayUrl}/relay...`);

    this.socket = io(`${relayWsUrl}/relay`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers
   */
  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('🌐 Relay: Connected to relay hub');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.register();

      broadcast('federation:relay-status', {
        connected: true,
        relayUrl: this.relayUrl
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`🌐 Relay: Disconnected (${reason})`);
      this.isConnected = false;
      this.connectedPeers.clear();

      broadcast('federation:relay-status', {
        connected: false,
        reason
      });
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.log(`🌐 Relay: Connection error (attempt ${this.reconnectAttempts}): ${error.message}`);

      broadcast('federation:relay-status', {
        connected: false,
        error: error.message,
        reconnectAttempts: this.reconnectAttempts
      });
    });

    // Peer events
    this.socket.on('relay:peer-joined', (data) => {
      const { serverId, manifest } = data;
      this.connectedPeers.set(serverId, manifest);
      console.log(`🌐 Relay: Peer joined: ${serverId}`);

      // Notify federation service
      if (this.federationService) {
        this.federationService.addPeer(manifest, `relay://${serverId}`);
      }

      // Persist to Neo4j via peer service
      const peerService = getPeerService();
      peerService.handleRelayPeerJoined(serverId, manifest);

      broadcast('federation:peer-update', {
        type: 'joined',
        peer: { serverId, ...manifest, viaRelay: true }
      });
    });

    this.socket.on('relay:peer-left', (data) => {
      const { serverId } = data;
      this.connectedPeers.delete(serverId);
      console.log(`🌐 Relay: Peer left: ${serverId}`);

      // Update peer health in Neo4j
      const peerService = getPeerService();
      peerService.handleRelayPeerLeft(serverId);

      broadcast('federation:peer-update', {
        type: 'left',
        peer: { serverId }
      });
    });

    // Incoming relayed messages
    this.socket.on('relay:message', (envelope, ackCallback) => {
      this.handleIncomingMessage(envelope, ackCallback);
    });

    // Incoming broadcasts
    this.socket.on('relay:broadcast', (payload) => {
      this.handleIncomingBroadcast(payload);
    });
  }

  /**
   * Register with relay hub
   */
  register() {
    if (!this.federationService?.identity) {
      console.log('🌐 Relay: Cannot register - no identity');
      return;
    }

    const manifest = this.federationService.getManifest();

    this.socket.emit('relay:register', manifest, (response) => {
      if (response.success) {
        console.log(`🌐 Relay: Registered as ${manifest.serverId}`);
        console.log(`🌐 Relay: ${response.peers.length} peer(s) online`);

        // Update connected peers
        this.connectedPeers.clear();
        for (const peer of response.peers) {
          this.connectedPeers.set(peer.serverId, peer.manifest);

          // Add to federation service
          if (this.federationService) {
            this.federationService.addPeer(peer.manifest, `relay://${peer.serverId}`);
          }
        }

        broadcast('federation:relay-registered', {
          serverId: manifest.serverId,
          peerCount: response.peers.length
        });
      } else {
        console.log(`🌐 Relay: Registration failed: ${response.error}`);
      }
    });
  }

  /**
   * Send message to specific peer
   */
  async sendToPeer(targetServerId, type, payload, options = {}) {
    if (!this.isConnected) {
      throw new Error('Not connected to relay');
    }

    const messageId = this.generateMessageId();
    const envelope = {
      to: targetServerId,
      type,
      payload,
      messageId,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error('Message timeout'));
      }, options.timeout || 30000);

      this.pendingMessages.set(messageId, { resolve, reject, timeout });

      this.socket.emit('relay:message', envelope, (response) => {
        clearTimeout(timeout);
        this.pendingMessages.delete(messageId);

        if (response.success) {
          resolve(response.ack);
        } else {
          reject(new Error(response.error || 'Message failed'));
        }
      });
    });
  }

  /**
   * Send large payload in chunks
   */
  async sendChunkedToPeer(targetServerId, type, payload) {
    if (!this.isConnected) {
      throw new Error('Not connected to relay');
    }

    const data = JSON.stringify(payload);
    const transferId = this.generateTransferId();
    const chunks = [];

    // Split into chunks
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      chunks.push(data.slice(i, i + CHUNK_SIZE));
    }

    console.log(`🌐 Relay: Sending chunked transfer ${transferId}: ${chunks.length} chunks, ${data.length} bytes`);

    // Start transfer
    this.socket.emit('relay:chunk-start', {
      transferId,
      to: targetServerId,
      type,
      totalChunks: chunks.length,
      totalSize: data.length
    });

    // Send chunks
    for (let i = 0; i < chunks.length; i++) {
      this.socket.emit('relay:chunk-data', {
        transferId,
        chunkIndex: i,
        chunk: chunks[i]
      });

      // Small delay to prevent flooding
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 10));
      }
    }

    // End transfer
    this.socket.emit('relay:chunk-end', { transferId });

    console.log(`🌐 Relay: Chunked transfer ${transferId} complete`);
  }

  /**
   * Broadcast to all connected peers
   */
  broadcastToAll(type, payload) {
    if (!this.isConnected) return;

    this.socket.emit('relay:broadcast', { type, payload });
  }

  /**
   * Handle incoming relayed message
   */
  handleIncomingMessage(envelope, ackCallback) {
    const { from, type, payload, chunked } = envelope;

    console.log(`🌐 Relay: Received ${type} from ${from}${chunked ? ' (chunked)' : ''}`);

    // Parse chunked payload
    let parsedPayload = payload;
    if (chunked && typeof payload === 'string') {
      parsedPayload = JSON.parse(payload);
    }

    // Check for registered handler
    const handler = this.messageHandlers.get(type);
    if (handler) {
      const response = handler(from, parsedPayload);
      if (typeof ackCallback === 'function') {
        ackCallback(response);
      }
    } else {
      console.log(`🌐 Relay: No handler for message type: ${type}`);
      if (typeof ackCallback === 'function') {
        ackCallback({ received: true, unhandled: true });
      }
    }
  }

  /**
   * Handle incoming broadcast
   */
  handleIncomingBroadcast(payload) {
    const { from, type } = payload;
    console.log(`🌐 Relay: Received broadcast ${type} from ${from}`);

    const handler = this.messageHandlers.get(`broadcast:${type}`);
    if (handler) {
      handler(from, payload);
    }
  }

  /**
   * Register message handler
   */
  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Get connected peers
   */
  getConnectedPeers() {
    return Array.from(this.connectedPeers.entries()).map(([serverId, manifest]) => ({
      serverId,
      ...manifest,
      viaRelay: true
    }));
  }

  /**
   * Check if a peer is connected via relay
   */
  isPeerConnected(serverId) {
    return this.connectedPeers.has(serverId);
  }

  /**
   * Get relay status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      relayUrl: this.relayUrl,
      connectedPeers: this.connectedPeers.size,
      peers: this.getConnectedPeers()
    };
  }

  /**
   * Disconnect from relay
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.connectedPeers.clear();
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Generate unique transfer ID
   */
  generateTransferId() {
    return `xfer_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// Singleton instance
let instance = null;

function getRelayClient() {
  if (!instance) {
    instance = new RelayClientService();
  }
  return instance;
}

module.exports = {
  RelayClientService,
  getRelayClient
};
