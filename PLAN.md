# void-server Evolution Roadmap

## Overview

This plan outlines improvements for void-server based on the existing architecture, manifesto vision ("consciousness emergence protocols"), and integration opportunities with the ClawedCode ecosystem.

**Priorities (per user input):**
1. Memory Sharing Network (with $CLAWED token economics)
2. AI Enhancements (RAG, embeddings, multi-model)
3. Federation Protocol (server-to-server communication)

---

## Phase 1: Federation Protocol Foundation ✅ COMPLETE

Enable void-server instances to discover and communicate with each other.

### 1.1 Server Identity & Discovery ✅
- **File:** `server/services/federation-service.js`
- Generate unique server identity using Ed25519 keypair (leverage existing tweetnacl)
- Server manifest endpoint: `GET /api/federation/manifest`
- Returns: serverId, publicKey, capabilities, neo4j version, plugin list

### 1.2 DHT-Based Peer Discovery ✅
- **File:** `server/services/dht-service.js`
- Implement Kademlia-style DHT for decentralized peer discovery
- Use libp2p or custom implementation with WebRTC/WebSocket transport
- Bootstrap nodes for initial network entry
- Peer announcement with server capabilities
- NAT traversal support for home-hosted instances

### 1.3 Peer Management ✅
- **File:** `server/services/peer-service.js`
- Store discovered peers in Neo4j (leverage graph for trust relationships)
- Health checking with exponential backoff
- Trust levels: `unknown`, `verified`, `trusted`
- Automatic peer scoring based on uptime and response quality

### 1.4 Secure Communication ✅
- Use TweetNaCl box with ed2curve for encrypted peer-to-peer messages
- Message signing for authenticity verification
- Challenge-response for peer verification

**Key Files to Modify:**
- `server/index.js` (mount federation routes)
- `server/routes/federation.js` (new)

---

## Phase 2: Memory Sharing Network 🚧 IN PROGRESS

Build on federation to enable cross-instance memory sharing with token economics.

### 2.1 Memory Export/Import Protocol ✅
- **File:** `server/services/memory-sync-service.js`
- Standardized memory schema for cross-instance compatibility
- Selective export by category, stage, or tag
- Content hashing for deduplication
- Delta sync support (only new/modified memories)

### 2.2 $CLAWED Token Integration
- **File:** `server/services/token-gate-service.js` (new)
- Leverage existing void-plugin-wallet for balance checks
- Use Helius RPC for balance verification

**Token Mechanics (Write-Gating Model):**
| Action | Token Requirement |
|--------|-------------------|
| Read shared memories | 500K $CLAWED balance (disciple threshold) |
| Write to egregore | Stake, burn, OR spend $CLAWED |
| Report bad data | Slash contributor's stake |

**Write Options:**
- **Stake**: Lock tokens as collateral (recoverable if memory stays valid)
- **Burn**: Permanently destroy tokens (strongest commitment signal)
- **Spend**: Transfer tokens to network treasury (funds development)

### 2.3 Memory Marketplace
- **File:** `server/services/memory-marketplace-service.js` (new)
- Memory quality scoring (based on usage, citations)
- Contributor reputation tracking
- Memory attribution chain (who shared what)

### 2.4 IPFS for Memory Distribution
- Leverage existing IPFS integration for decentralized storage
- Pin high-value memories to IPFS for persistence
- CID-based memory addressing for immutability

**Key Files to Modify:**
- `server/services/memory-service.js` (add export/import methods)
- `plugins/void-plugin-wallet/` (add balance check API)

---

## Phase 3: AI Enhancements

Improve memory retrieval, embedding quality, and model flexibility.

### 3.1 Enhanced RAG Pipeline
- **File:** `server/services/rag-service.js` (new)
- Hybrid search: combine vector similarity + keyword + graph traversal
- Context window optimization (dynamic context sizing)
- Memory relevance scoring with recency decay
- Citation tracking in responses

### 3.2 Embedding Improvements (Ollama-Only)
- **File:** `server/services/embedding-service.js` (modify)
- Local embeddings via Ollama (self-hosted philosophy)
- Support multiple Ollama models (nomic-embed-text, mxbai-embed-large, etc.)
- Configurable embedding dimensions per model
- Batch processing for large memory imports
- Embedding versioning (re-embed on model change)

### 3.3 Multi-Model Orchestration
- **File:** `server/services/ai-orchestrator.js` (new)
- Model routing based on task type
- Fallback chains (try Claude → OpenAI → local)
- Cost tracking per provider
- Response quality metrics

### 3.4 Memory Graph Enhancements
- Automatic relationship extraction from chat
- Entity linking (connect mentions to known entities)
- Temporal reasoning (when did I learn X?)
- Contradiction detection

**Key Files to Modify:**
- `server/services/prompt-executor.js` (integrate RAG)
- `server/services/memory-query-service.js` (hybrid search)
- `config/ai-providers.json` (multi-model config)

---

## Phase 4: Plugin Ecosystem Expansion

Enhance the plugin system for community contributions.

### 4.1 Plugin Marketplace
- **File:** `server/services/plugin-marketplace-service.js` (new)
- Plugin discovery registry (JSON file or decentralized)
- Version compatibility checking
- Automatic update notifications
- Plugin ratings/reviews (stored in Neo4j)

### 4.2 Plugin Capabilities API
- Define capability contracts for plugins
- Memory access API for plugins
- Chat context injection API
- Cross-plugin communication

### 4.3 Community Plugin Ideas
- `void-plugin-chat` - Federation-based chat (from Void-Chat patterns)
- `void-plugin-knowledge` - Wikipedia/docs ingestion
- `void-plugin-calendar` - Event scheduling with memory
- `void-plugin-analytics` - Usage and engagement metrics

---

## Phase 5: UI/UX Improvements

Enhance the client experience.

### 5.1 Memory Visualization
- 3D knowledge graph explorer (enhance existing)
- Timeline view for memory evolution
- Memory clusters by topic/category
- Relationship path visualization

### 5.2 Chat Enhancements
- Branch comparison view
- Memory citation highlights
- Thinking block expansion controls
- Voice input/output support

### 5.3 Federation Dashboard
- Connected peers visualization
- Memory sync status
- Token stake/balance display
- Network health metrics

---

## Implementation Order (Recommended)

1. **Federation Foundation** (Phase 1.1-1.4)
   - Establishes the network primitives needed for everything else
   - Files: ~3 new services, route additions

2. **AI Enhancements - RAG** (Phase 3.1-3.2)
   - Immediate value improvement for existing users
   - Files: 2 new services, modify existing

3. **Memory Sharing Core** (Phase 2.1)
   - Basic export/import without token gating
   - Files: 1 new service, modify memory-service

4. **Token Integration** (Phase 2.2-2.3)
   - Add economic layer once sharing works
   - Files: 2 new services, wallet plugin changes

5. **Multi-Model & Orchestration** (Phase 3.3-3.4)
   - Enhanced AI capabilities
   - Files: 1 new service, provider modifications

6. **Plugin Marketplace** (Phase 4.1-4.2)
   - Community growth features
   - Files: 1 new service, plugin system enhancements

---

## Architecture Decisions

### Why Neo4j for Federation?
- Already the memory store
- Native graph traversal for relationship queries
- Can store peer relationships and trust graphs
- Existing backup/restore infrastructure

### Why Not Full Chat Integration?
- User specified federation-only approach
- Keep void-server focused on AI memory
- Void-Chat can remain separate for messaging
- Server-to-server focus enables memory sharing without user chat complexity

### Token Economics Rationale (Write-Gating)
- **500K threshold for read**: Creates baseline demand, aligns with disciple tier
- **Stake/burn/spend to write**: Multiple commitment paths for contributors
- **Slash for bad data**: Community governance with economic consequences
- **Treasury spend option**: Sustainable funding for network development

---

## Critical Files Reference

| Component | Key Files |
|-----------|-----------|
| Server Entry | `server/index.js` |
| Memory System | `server/services/memory-service.js`, `memory-query-service.js` |
| Neo4j Layer | `server/services/neo4j-service.js` |
| AI Providers | `server/services/ai-provider.js`, `prompt-executor.js` |
| Embeddings | `server/services/embedding-service.js` |
| Wallet Plugin | `plugins/void-plugin-wallet/` |
| Plugin System | `server/plugins.js` |
| IPFS | `server/services/ipfs-service.js` |
| Client App | `client/src/App.jsx` |
| Memories Page | `client/src/pages/MemoriesPage.jsx` |

---

## Decisions Made

- **Discovery**: DHT-based (decentralized, Kademlia-style)
- **Token threshold**: 500K $CLAWED for read access (disciple level)
- **Write access**: Stake, burn, or spend $CLAWED
- **Embeddings**: Ollama-only (self-hosted)

---

## Current Progress

### Completed
- [x] Plan created and approved
- [x] Phase 1.1: Server Identity & Discovery
  - Created `federation-service.js` with Ed25519 keypairs
  - Created `federation.js` routes
  - Mounted routes in `server/index.js`
  - Added Cucumber tests for federation endpoints
  - All federation endpoints tested and working
- [x] Phase 1.2: DHT-Based Peer Discovery
  - Created `dht-service.js` with Kademlia-style DHT
  - 256-bit node IDs from SHA-256 of public key
  - K-buckets (K=20) with XOR distance metric
  - Bootstrap node configuration
  - Iterative FIND_NODE lookup
  - Automatic node announcement
  - Periodic routing table refresh
  - DHT routes integrated into federation API

- [x] Phase 1.3: Peer Management (Neo4j)
  - Created `peer-service.js` with Neo4j integration
  - Trust levels: unknown, seen, verified, trusted, blocked
  - Health checking with scoring and exponential decay
  - Trust graph queries for visualization
  - Trust score calculation based on network position
  - CRUD operations for peers in Neo4j
  - Trust relationship management
  - Periodic health checks with automatic scoring
  - Added Cucumber tests for Neo4j peer endpoints
  - All peer management endpoints tested and working

- [x] Phase 1.4: Secure Communication
  - Added ed2curve for proper Ed25519 to Curve25519 key conversion
  - TweetNaCl box encryption for peer-to-peer messages
  - Message signing with Ed25519 for authenticity verification
  - Challenge-response protocol for peer verification
  - `sendSecureMessage()` method for encrypted communication
  - `verifyPeer()` method for mutual authentication
  - Crypto self-test endpoint for debugging
  - Added Cucumber tests for secure communication

### Phase 1 Complete!
Federation Protocol Foundation is now complete with:
- Server identity (Ed25519 keypairs)
- DHT-based peer discovery (Kademlia-style)
- Neo4j peer management with trust graphs
- Secure encrypted communication

### Next Up
- [ ] Phase 2.1: Memory Export/Import Protocol
