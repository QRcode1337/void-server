# Federation Guide

This guide explains how to connect void-server instances and share memories across the federation network.

## Overview

Federation enables multiple void-server instances to:
- Discover and connect to each other
- Share memories across the network
- Build trust relationships between peers
- Pin memories to IPFS for decentralized storage

## Connection Methods

void-server supports two federation modes:

| Mode | Best For | Requirements |
|------|----------|--------------|
| **Relay** (default) | Home users, NAT/firewall environments | None - just run void-server |
| **DHT** (legacy) | Public servers with static IPs | `PUBLIC_URL` environment variable |

## WebSocket Relay (Recommended)

The relay mode is **NAT-friendly** - peers connect through a central relay hub without exposing their IP addresses or requiring port forwarding.

### How It Works

```
                    void-mud (Relay Hub)
                    ┌─────────────────┐
                    │  WebSocket Hub  │
                    │  - Peer registry│
                    │  - Msg routing  │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              │ WSS          │ WSS          │ WSS
              ▼              ▼              ▼
         void-server    void-server    void-server
           (NAT)          (NAT)         (public)
```

1. When void-server starts, it connects outbound to the relay hub (void-mud.onrender.com)
2. The relay hub notifies all connected peers when someone joins/leaves
3. Messages between peers are routed through the relay hub
4. Large payloads (memory exports) use chunked transfer protocol

### Automatic Peer Discovery

With relay mode, **peers are discovered automatically**. When another void-server connects to the same relay hub, both instances immediately see each other in the Federation UI.

No manual peer configuration needed!

### Check Relay Status

**Via the UI:**
1. Navigate to **Federation** in the sidebar
2. The **Relay Network** card shows:
   - Connection status (Connected/Disconnected)
   - Relay hub URL
   - Number of online peers
   - List of currently connected peer IDs

**Via API:**
```bash
curl http://localhost:4420/api/federation/relay/status

# Response:
{
  "success": true,
  "mode": "relay",
  "relayEnabled": true,
  "connected": true,
  "relayUrl": "https://void-mud.onrender.com",
  "connectedPeers": 2,
  "peers": [
    { "serverId": "void-a1b2c3d4", ... },
    { "serverId": "void-e5f6g7h8", ... }
  ]
}
```

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RELAY_URL` | `https://void-mud.onrender.com` | Custom relay hub URL |
| `FEDERATION_MODE` | `relay` | Set to `dht` for legacy DHT mode |

## DHT Mode (Legacy)

DHT (Distributed Hash Table) mode requires peers to have public URLs and direct connectivity. Use this if you're running servers with static public IPs.

### Enable DHT Mode

```bash
# In .env
FEDERATION_MODE=dht
PUBLIC_URL=https://your-server.com:4420
```

## Bootstrap Nodes (DHT Mode)

Bootstrap nodes are the entry points to the DHT network. They help new nodes discover existing peers via DHT routing.

### How It Works

1. When void-server starts, it connects to known bootstrap nodes
2. Bootstrap nodes share their routing tables with the new node
3. The new node can now discover and connect to other peers via DHT lookup
4. Once connected to any peer, DHT queries can find any other node in the network

### Deploy Your Own Bootstrap Node

Deploy a lightweight bootstrap node with one click:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ClawedCode/void-server)

Bootstrap nodes run in "Bootstrap Mode" which:
- Enables only federation/DHT endpoints
- Disables memory storage, AI, plugins, and other features
- Uses minimal resources (~50MB RAM)
- Works on Render.com's free tier

### Configure Bootstrap Nodes

Add known bootstrap nodes to your local configuration:

```bash
# Via API
curl -X POST http://localhost:4420/api/federation/dht/bootstrap-nodes \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "https://your-bootstrap.onrender.com", "name": "My Bootstrap"}'

# Or edit the config file directly
# data/federation/bootstrap-nodes.json
[
  { "endpoint": "https://void-bootstrap-1.onrender.com", "name": "Primary" }
]
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BOOTSTRAP_MODE` | `false` | Enable lightweight bootstrap mode |
| `PORT` | `4420` | Server port |
| `PUBLIC_URL` | auto | Your server's public URL (for federation) |

## Getting Your Connection Info

### Via the UI

1. Navigate to **Federation** in the sidebar
2. In the **Server Identity** card, you'll see:
   - **Server ID**: Your unique identifier (e.g., `void-a1b2c3d4`)
   - **Public Key**: Your Ed25519 public key for cryptographic verification
3. Click **Copy Connection Info** to copy all details as JSON

### Via API

```bash
# Get your server manifest
curl http://localhost:4420/api/federation/manifest

# Response:
{
  "success": true,
  "manifest": {
    "serverId": "void-a1b2c3d4",
    "publicKey": "base64-encoded-public-key",
    "version": "0.16.0",
    "capabilities": ["memory", "neo4j", "ipfs", "wallet"]
  }
}
```

## Connecting to a Peer

You can connect to peers using two methods:

### Method 1: Endpoint URL

The most reliable method - requires the peer's full URL.

**Via the UI:**
1. Go to **Federation** in the sidebar
2. In the **Add Peer** card, select **Endpoint URL** tab
3. Enter the peer's endpoint URL (e.g., `https://peer.example.com:4420`)
4. Click **Connect**

**Via API:**
```bash
curl -X POST http://localhost:4420/api/federation/peers \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "https://peer.example.com:4420"}'
```

### Method 2: Node ID (DHT Lookup)

Connect using the peer's DHT Node ID - useful when you don't have their endpoint.

**Via the UI:**
1. Go to **Federation** in the sidebar
2. In the **Add Peer** card, select **Node ID (DHT)** tab
3. Enter the Node ID (full 64-character hex, or partial for local matches)
4. Click **Lookup**

**Via API:**
```bash
# Look up a node by ID
curl http://localhost:4420/api/federation/dht/lookup/abc123def456...

# Connect by Node ID
curl -X POST http://localhost:4420/api/federation/peers/connect-by-id \
  -H "Content-Type: application/json" \
  -d '{"nodeId": "abc123def456..."}'
```

**How DHT Lookup Works:**
- **Partial IDs** (< 64 chars): Searches locally known peers by prefix match
- **Full IDs** (64 chars): Uses Kademlia DHT routing to find the node across the network
- Once found, the peer's endpoint is retrieved and connection is established automatically

> **Note**: DHT lookup requires the target node to have been discovered through the network. For first-time connections between isolated networks, use the endpoint URL method.

## Sharing Connection Info

To let someone connect to your server, share:

1. **Your endpoint URL** - The URL where your server is accessible
   - For local network: `http://your-local-ip:4420`
   - For internet: Your public URL or domain

2. **Your connection info** (optional, for verification):
   ```json
   {
     "serverId": "void-a1b2c3d4",
     "publicKey": "your-base64-public-key",
     "endpoint": "https://your-server.com:4420"
   }
   ```

### Network Requirements

For peers to connect to you:
- Your server must be reachable from their network
- Port 4420 (or your configured port) must be accessible
- For internet peers: configure port forwarding or use a reverse proxy

## Trust Levels

Peers progress through trust levels based on interactions:

| Level | Description |
|-------|-------------|
| `unknown` | New peer, not yet verified |
| `seen` | Peer has been contacted |
| `verified` | Peer completed challenge-response verification |
| `trusted` | Manually trusted or high reputation |
| `blocked` | Blocked from federation |

### Managing Trust

```bash
# Verify a peer (challenge-response)
curl -X POST http://localhost:4420/api/federation/verify-peer \
  -H "Content-Type: application/json" \
  -d '{"serverId": "void-b2c3d4e5"}'

# Block a peer
curl -X POST http://localhost:4420/api/federation/peers/neo4j/void-b2c3d4e5/block \
  -H "Content-Type: application/json" \
  -d '{"reason": "Spam"}'

# Unblock a peer
curl -X POST http://localhost:4420/api/federation/peers/neo4j/void-b2c3d4e5/unblock
```

## Sharing Memories

### Export Memories

```bash
# Export all memories (with signature for verification)
curl -X POST http://localhost:4420/api/federation/memories/export \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'

# Export by category
curl -X POST http://localhost:4420/api/federation/memories/export \
  -H "Content-Type: application/json" \
  -d '{"category": "emergence", "limit": 50}'

# Export high-importance memories
curl -X POST http://localhost:4420/api/federation/memories/export \
  -H "Content-Type: application/json" \
  -d '{"minImportance": 0.8}'
```

### Import Memories

```bash
# Preview import (dry run)
curl -X POST http://localhost:4420/api/federation/memories/import \
  -H "Content-Type: application/json" \
  -d '{"exportData": {...}, "dryRun": true}'

# Import memories
curl -X POST http://localhost:4420/api/federation/memories/import \
  -H "Content-Type: application/json" \
  -d '{"exportData": {...}}'
```

### Delta Sync with Peer

```bash
# Sync only new memories since last sync
curl -X POST http://localhost:4420/api/federation/memories/sync/void-b2c3d4e5
```

## Token-Gated Access

Memory sharing can be gated by $CLAWED token balance:

| Action | Required Tier | Token Balance |
|--------|--------------|---------------|
| Read shared memories | DISCIPLE | 500,000 |
| Write to federation | ACOLYTE | 1,000,000 |
| Manage peers | ACOLYTE | 1,000,000 |
| Admin functions | ARCHITECT | 10,000,000 |

```bash
# Check access for a wallet
curl "http://localhost:4420/api/federation/token-gate/check?wallet=YOUR_WALLET&feature=federation:read_memories"

# Use gated endpoints with wallet header
curl -X POST http://localhost:4420/api/federation/gated/memories/export \
  -H "X-Wallet-Address: YOUR_WALLET" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

## IPFS Memory Distribution

Pin memories to IPFS for permanent, decentralized storage:

```bash
# Get IPFS stats
curl http://localhost:4420/api/federation/ipfs/stats

# Pin a specific memory
curl -X POST http://localhost:4420/api/federation/ipfs/pin/MEMORY_ID

# Pin multiple memories as a collection
curl -X POST http://localhost:4420/api/federation/ipfs/pin-collection \
  -H "Content-Type: application/json" \
  -d '{"memoryIds": ["mem1", "mem2"], "name": "my-collection"}'

# Auto-pin high quality memories
curl -X POST http://localhost:4420/api/federation/ipfs/auto-pin \
  -H "Content-Type: application/json" \
  -d '{"threshold": 10, "limit": 50}'

# Import memory from IPFS by CID
curl -X POST http://localhost:4420/api/federation/ipfs/import/QmXYZ... \
  -H "Content-Type: application/json"

# Publish to Pinata for wider distribution
curl -X POST http://localhost:4420/api/federation/ipfs/publish-pinata/MEMORY_ID
```

## Memory Marketplace

Track quality and reputation for federated memories:

```bash
# Get marketplace stats
curl http://localhost:4420/api/federation/marketplace/stats

# Get top quality memories
curl http://localhost:4420/api/federation/marketplace/top-memories

# Get top contributors
curl http://localhost:4420/api/federation/marketplace/top-contributors

# Vote on a memory
curl -X POST http://localhost:4420/api/federation/marketplace/memory/MEMORY_ID/vote \
  -H "Content-Type: application/json" \
  -d '{"vote": 1, "voterId": "void-a1b2c3d4"}'
```

### Quality Scoring

Memories are scored based on:
- Views: +0.1 per view
- Interactions: +0.5 per use in chat
- Citations: +2.0 per citation
- Upvotes: +1.0 each
- Downvotes: -1.5 each
- Age decay: 0.99 daily multiplier

### Reputation Tiers

Contributors earn reputation based on their shared memories:

| Tier | Reputation |
|------|------------|
| NEWCOMER | 0+ |
| CONTRIBUTOR | 100+ |
| TRUSTED | 500+ |
| EXPERT | 1,000+ |
| SAGE | 5,000+ |

## Troubleshooting

### Peer won't connect

1. Verify the endpoint URL is correct and accessible
2. Check if the peer's server is running
3. Ensure no firewall is blocking port 4420
4. Try pinging: `curl https://peer.example.com:4420/api/federation/ping`

### Memory import fails

1. Check if the export signature is valid
2. Verify the source server is not blocked
3. Check for duplicate memories (same content hash)

### IPFS pinning fails

1. Verify IPFS daemon is running: check Federation → IPFS stats
2. Check IPFS gateway connectivity
3. For Pinata: ensure JWT is configured in `data/ipfs.json`

## API Reference

See the full API at `/api/federation/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/manifest` | GET | Get server identity |
| `/status` | GET | Get federation status |
| `/peers` | GET/POST | List or add peers |
| `/peers/connect-by-id` | POST | Connect to peer by Node ID |
| `/peers/neo4j` | GET | List Neo4j peers |
| `/dht/status` | GET | Get DHT network status |
| `/dht/lookup/:nodeId` | GET | Look up node by ID |
| `/memories/export` | POST | Export memories |
| `/memories/import` | POST | Import memories |
| `/ipfs/stats` | GET | Get IPFS stats |
| `/ipfs/pin/:id` | POST | Pin memory to IPFS |
| `/marketplace/stats` | GET | Get marketplace stats |
| `/token-gate/config` | GET | Get token gate config |
