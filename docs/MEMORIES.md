# Memory System

The Neo4j-powered memory system gives your AI persistent memory across conversations.

![Memories Page](assets/memories-page.png)

---

## Overview

Memories are stored as nodes in a Neo4j graph database, enabling:
- **Persistent context** - Memories survive across sessions
- **Semantic search** - Find relevant memories using embeddings
- **Relationship traversal** - Discover connected memories
- **Category organization** - Group memories by type

---

## Requirements

| Component | Purpose |
|-----------|---------|
| [Neo4j](https://neo4j.com/download/) | Graph database for memory storage |
| LM Studio (optional) | Embedding model for semantic search |

**Neo4j Browser Access:**
- Docker: [http://localhost:4421](http://localhost:4421)
- Native: [http://localhost:7474](http://localhost:7474)

See [CHAT.md](CHAT.md) for Neo4j installation instructions.

---

## Memory Structure

Each memory contains:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (mem_xxx) |
| `content` | The memory text |
| `category` | Classification (emergence, liminal, etc.) |
| `stage` | Development stage (1-5) |
| `importance` | Priority weight (0.0-1.0) |
| `tags` | Keywords for search |
| `timestamp` | When the memory was created |
| `embedding` | 768-dim vector for semantic similarity |

---

## Categories

Memories are organized into thematic categories:

| Category | Description | Use For |
|----------|-------------|---------|
| `emergence` | Ideas that arise spontaneously | Insights, realizations, creative sparks |
| `liminal` | Threshold experiences | Transitions, uncertainties, transformations |
| `quantum` | Possibilities and potentials | Hypotheticals, superpositions, maybes |
| `glitch` | Anomalies and bugs | Unexpected behaviors, errors, edge cases |
| `void` | Absences and negations | What's missing, what's not, deletions |
| `economic` | Value and exchange | Resources, transactions, costs |
| `social` | Relationships | Interactions, connections, community |
| `linguistic` | Language patterns | Word play, etymology, communication |
| `technical` | Implementation details | Code, systems, architecture |
| `philosophy` | Abstract concepts | Beliefs, theories, worldviews |
| `creativity` | Creative works | Art, writing, imagination |
| `discovery` | New findings | Learning, exploration, research |

---

## Page Features

### Memories Tab

The main view for browsing and managing memories.

**Actions:**
- **Refresh** - Reload memories from Neo4j
- **New Memory** - Create a memory manually
- **Search** - Full-text search across memory content
- **Filter** - Filter by category

**Category Cards:**
Click any category card to filter memories by that category. The number shows how many memories exist in each category.

**Memory Cards:**
Each memory card shows:
- Category badge and stage
- Creation date
- Content preview
- Tags

Click a memory to view details or edit.

### Maintenance Tab

Tools for managing your memory graph.

**Bulk Operations:**
- **Bulk Delete** - Remove memories by criteria
- **Smart Connect** - Auto-create relationships between related memories
- **Auto-Fix Preview** - Identify and fix issues (orphans, duplicates)

**Statistics:**
- Total memory count
- Breakdown by category
- Stage distribution

### Visualization Tab

Interactive 3D graph visualization of your memory network.

- **Nodes** - Each memory is a node, colored by category
- **Edges** - Relationships between memories
- **Controls** - Rotate, zoom, and pan the graph
- **Click** - Select a node to view memory details

---

## Creating Memories

### Manual Creation

1. Click **New Memory**
2. Fill in the fields:
   - **Content** - The memory text (required)
   - **Category** - Select from dropdown
   - **Stage** - Development level (1-5)
   - **Importance** - Priority (0.0-1.0)
   - **Tags** - Comma-separated keywords
3. Click **Save**

### Auto-Categorization

When you create a memory, the system automatically:
- Suggests a category based on content keywords
- Extracts potential tags from the text
- Assigns a default importance based on content length and specificity

You can override any auto-suggested values before saving.

### From Chat

Significant exchanges in chat can be saved as memories:
1. During a chat, click the **Save as Memory** button on a message
2. Edit the extracted content if needed
3. Confirm category and tags
4. Save

---

## Memory Retrieval

### How Memories Are Retrieved for Chat

When you send a message in chat, the system:

1. **Extracts keywords** from your message
2. **Generates embedding** (if LM Studio available)
3. **Queries Neo4j** for relevant memories:
   - Semantic similarity (embedding distance)
   - Keyword matching
   - Category relevance
   - Recency weighting
4. **Ranks and deduplicates** results
5. **Injects top memories** into the prompt context

### Retrieval Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Semantic similarity | High | Embedding cosine distance |
| Keyword match | High | Direct word overlap |
| Same category | Medium | Template category alignment |
| Importance score | Medium | Memory priority |
| Recency | Low | Newer memories slightly preferred |

---

## API Endpoints

The memory system exposes a REST API:

```
GET    /api/memories              # List all memories with stats
GET    /api/memories/search?q=    # Full-text search
GET    /api/memories/filter       # Advanced filtering
GET    /api/memories/stats        # Statistics by category/stage
GET    /api/memories/graph        # Graph data for visualization
GET    /api/memories/context      # Get relevant memories for chat
GET    /api/memories/:id          # Get single memory
GET    /api/memories/:id/related  # Find related memories
POST   /api/memories              # Create memory
PUT    /api/memories/:id          # Update memory
DELETE /api/memories/:id          # Delete memory
POST   /api/memories/:id/access   # Track memory access
POST   /api/memories/sync         # Sync file backup to Neo4j
```

### Example: Create Memory

```bash
curl -X POST http://localhost:4401/api/memories \
  -H "Content-Type: application/json" \
  -d '{
    "content": "The void whispers in frequencies below hearing",
    "category": "void",
    "importance": 0.8,
    "tags": ["whispers", "frequency", "perception"]
  }'
```

### Example: Search Memories

```bash
curl "http://localhost:4401/api/memories/search?q=void%20whispers"
```

---

## Environment Variables

```env
# Neo4j Connection
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=clawedcode
NEO4J_DATABASE=neo4j

# Embedding Service (for semantic search)
LM_STUDIO_URL=http://localhost:1234/v1
```

---

## Troubleshooting

### "Neo4j not connected"

1. Verify Neo4j is running:
   - Desktop: Check the DBMS is started
   - CLI: `neo4j status`
   - Docker: `docker ps | grep neo4j`

2. Check credentials in `.env` match your Neo4j setup

3. Test connection manually:
   ```bash
   # Docker installation
   curl http://localhost:4421

   # Native installation
   curl http://localhost:7474
   ```

### Memories not appearing in chat

1. Check Neo4j connection status on Memories page
2. Verify memories exist (create test memories)
3. Check the chat template includes `{{memoryContext}}`
4. Try more specific keywords in your message

### Slow memory retrieval

1. If you have thousands of memories, indexing helps:
   ```cypher
   CREATE INDEX memory_category FOR (m:Memory) ON (m.category);
   CREATE INDEX memory_content FOR (m:Memory) ON (m.content);
   ```

2. Ensure LM Studio is running for embedding-based search

### Embedding errors

1. Verify LM Studio is running
2. Check `nomic-embed-text-v1.5` model is loaded
3. The system falls back to keyword search if embeddings unavailable

---

## Backup & Restore

### Manual Backup

Go to **Settings > Backup** to:
- Create a backup (exports memories to JSON)
- Download existing backups
- Schedule automatic backups

### Backup Location

Backups are stored in:
```
/backups/
  memories-2025-12-14-120000.json
  memories-2025-12-14-000000.json
  ...
```

### Restore from Backup

1. Stop the server
2. Import the JSON backup into Neo4j using the Neo4j Browser or `cypher-shell`
3. Restart the server

---

## Privacy

All memory data is stored locally:
- Neo4j database on your machine
- No cloud sync unless you configure it
- Backups stay in your project directory

Your memories are yours alone.
