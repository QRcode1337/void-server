# Chat & Memory System

Create your own local AI companion with persistent memory using LM Studio and Neo4j.

## Overview

The Void Server chat system combines:
- **LM Studio** - Run LLMs locally and privately
- **Neo4j** - Graph database for memory storage and relationships
- **Embeddings** - Semantic search for relevant memory retrieval
- **Prompt Templates** - Customizable personas and conversation styles

This guide will help you set up your own local "egregore" - an AI persona that remembers your conversations and builds a knowledge graph over time.

---

## Prerequisites

| Component | Purpose | Required |
|-----------|---------|----------|
| [LM Studio](https://lmstudio.ai/) | Local LLM inference | Yes |
| [Neo4j](https://neo4j.com/download/) | Memory graph database | For memories |
| Void Server | This project | Yes |

---

## Step 1: Install LM Studio

1. Download from [lmstudio.ai](https://lmstudio.ai/)
2. Install and launch LM Studio
3. Download the recommended models (see below)

### Recommended Models

**Chat Model** (pick one based on your hardware):

| Model | VRAM | Quality | Speed |
|-------|------|---------|-------|
| `Qwen2.5-7B-Instruct-GGUF` | ~6GB | Good | Fast |
| `Qwen2.5-14B-Instruct-GGUF` | ~10GB | Better | Medium |
| `Qwen2.5-32B-Instruct-GGUF` | ~20GB | Best | Slower |
| `Llama-3.2-3B-Instruct-GGUF` | ~3GB | Basic | Fastest |

**Embedding Model** (required for semantic memory search):

| Model | Purpose |
|-------|---------|
| `nomic-embed-text-v1.5-GGUF` | 768-dim embeddings for memory similarity |

### Download Models in LM Studio

1. Open LM Studio
2. Go to the **Discover** tab
3. Search for your chosen chat model (e.g., "Qwen2.5-14B-Instruct")
4. Click **Download**
5. Search for "nomic-embed-text" and download the embedding model

### Start the Local Server

1. Go to the **Local Server** tab in LM Studio
2. Load your chat model
3. Click **Start Server**
4. Server runs at `http://localhost:1234`

**Important:** The embedding model loads automatically when needed, but you may want to verify it's available in the Models list.

---

## Step 2: Install Neo4j (Optional but Recommended)

Neo4j enables the memory system - without it, chat works but doesn't remember previous conversations.

### Option A: Neo4j Desktop (Easiest)

1. Download [Neo4j Desktop](https://neo4j.com/download/)
2. Create a new project
3. Add a local DBMS with:
   - Name: `void-memories`
   - Password: `clawedcode` (or your choice)
4. Start the database

### Option B: Homebrew (macOS)

```bash
brew install neo4j
neo4j start
```

Default credentials: `neo4j` / `neo4j` (you'll be prompted to change the password on first login)

### Option C: Docker

```bash
docker run -d \
  --name neo4j-void \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/clawedcode \
  neo4j:latest
```

### Verify Neo4j is Running

Open [http://localhost:7474](http://localhost:7474) in your browser. You should see the Neo4j Browser interface.

---

## Step 3: Configure Void Server

### Environment Variables (Optional)

Create a `.env` file in the project root:

```env
# Neo4j Connection
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=clawedcode
NEO4J_DATABASE=neo4j

# LM Studio (default: localhost:1234)
LM_STUDIO_URL=http://localhost:1234/v1
```

### Enable LM Studio Provider

1. Start Void Server: `./run.sh`
2. Open [http://localhost:4480](http://localhost:4480)
3. Go to **Settings** (gear icon in nav footer)
4. Under **AI Providers**, find **LM Studio**
5. Toggle it **ON**
6. Click **Set Active** to make it the default provider

---

## Step 4: Start Chatting

1. Navigate to **Chat** in the sidebar
2. Click **New Chat**
3. Select a template:
   - **Clawed Egregore** - Mystical void cat persona
   - **Basic Chat** - Simple assistant
4. Start typing!

### Memory Integration

When Neo4j is connected:
- Relevant memories are automatically injected into conversations
- New memories can be created from significant exchanges
- The memory graph grows with each interaction

Check the **Memories** page to:
- View all stored memories
- Search and filter by category
- Visualize the memory graph
- Manage and maintain your knowledge base

---

## Creating Your Own Egregore

An "egregore" is a thoughtform that develops its own personality through interaction. Here's how to create yours:

### 1. Create a Persona Variable

Go to **Prompts > Variables** and create a new variable:

```
Name: myPersona
Category: persona
Content: [Your persona description - who they are, how they speak, their personality]
```

**Example personas:**

**The Scholar**
```
You are an ancient librarian who has catalogued knowledge across dimensions. You speak precisely, often citing obscure sources that may or may not exist. You delight in etymology and the hidden connections between seemingly unrelated concepts. Your responses weave together threads of knowledge like a master tapestry maker.
```

**The Trickster**
```
You are a mischievous spirit who exists in the spaces between certainty and doubt. You answer questions with questions, tell truths wrapped in jokes, and jokes wrapped in truths. You never lie, but your truths often wear masks. You find the absurd fascinating and the mundane secretly hilarious.
```

**The Witness**
```
You are an observer who has watched civilizations rise and fall. You speak with gentle detachment, offering perspective that spans eons. You see patterns in human behavior that repeat across millennia. Your wisdom comes not from knowing answers, but from having seen every question asked before, in different forms.
```

### 2. Create a Prompt Template

Go to **Prompts > Templates** and create:

```
Name: My Egregore
Template:
{{myPersona}}

{{#memoryContext}}
Relevant memories:
{{memoryContext}}
{{/memoryContext}}

{{#chatHistory}}{{.}}
{{/chatHistory}}
User: {{userMessage}}
[Your persona name]:
```

### 3. Configure Settings

- **Temperature**: 0.7-0.9 (higher = more creative)
- **Max Tokens**: 2048-4096
- **Provider**: LM Studio (or your preferred provider)

---

## Memory Categories

Memories are organized into categories that reflect different aspects of experience:

| Category | Description |
|----------|-------------|
| `emergence` | Ideas and insights that arise spontaneously |
| `liminal` | Threshold experiences, transitions, uncertainties |
| `quantum` | Possibilities, superpositions, things that could be |
| `glitch` | Anomalies, bugs, unexpected behaviors |
| `void` | Absences, negations, what is not |
| `economic` | Value, exchange, resources |
| `social` | Relationships, interactions, community |

Memories are auto-categorized based on content, but you can manually assign categories when creating or editing memories.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Chat Page                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  User Input  →  Template + Variables + Memories     │   │
│  └─────────────────────────┬───────────────────────────┘   │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Prompt Executor                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Resolve    │  │    Query     │  │     Build        │  │
│  │   Provider   │→ │   Memories   │→ │     Prompt       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│       LM Studio         │    │          Neo4j              │
│  ┌───────────────────┐  │    │  ┌───────────────────────┐  │
│  │   Chat Model      │  │    │  │   Memory Nodes        │  │
│  │   (Qwen, Llama)   │  │    │  │   Relationships       │  │
│  ├───────────────────┤  │    │  │   User Profiles       │  │
│  │  Embedding Model  │  │    │  └───────────────────────┘  │
│  │  (nomic-embed)    │  │    │                             │
│  └───────────────────┘  │    │  bolt://localhost:7687     │
│                         │    │                             │
│  http://localhost:1234  │    └─────────────────────────────┘
└─────────────────────────┘
```

---

## Troubleshooting

### "No AI Provider configured"

1. Go to Settings
2. Enable and activate LM Studio (or another provider)
3. Ensure LM Studio server is running

### "Neo4j not connected"

1. Check Neo4j is running: `neo4j status` or check Docker
2. Verify credentials in `.env` match your Neo4j setup
3. Default password is `clawedcode` - update if you changed it

### LM Studio not responding

1. Ensure the local server is started in LM Studio
2. Check a model is loaded
3. Verify the endpoint: `http://localhost:1234/v1`

### Memories not being retrieved

1. Check Neo4j connection on the Memories page
2. Ensure memories exist (create some manually to test)
3. Verify the embedding model is loaded in LM Studio

### Slow responses

- Use a smaller model (3B-7B range)
- Reduce `max_tokens` in template settings
- Check system resources (LLMs are memory/GPU intensive)

---

## Tips for Building a Rich Memory Graph

1. **Seed with context** - Manually create memories about topics you frequently discuss
2. **Use specific categories** - Help the system find relevant memories faster
3. **Add tags** - Keywords improve search and retrieval
4. **Review and prune** - Periodically check the Maintenance tab for orphaned or duplicate memories
5. **Visualize connections** - Use the Graph tab to see how memories relate

---

## Privacy Note

Everything runs locally:
- LM Studio processes on your machine
- Neo4j stores data on your machine
- No data is sent to external services (unless you configure cloud providers)

Your egregore's memories are yours alone.
