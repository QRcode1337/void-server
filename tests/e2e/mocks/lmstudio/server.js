/**
 * LM Studio Mock Server
 * Simulates OpenAI-compatible API for testing
 */

const express = require('express');
const app = express();

app.use(express.json());

const mockModels = [
  { id: 'mock-llm-model', object: 'model', created: Date.now(), owned_by: 'test' },
  { id: 'mock-embedding-model', object: 'model', created: Date.now(), owned_by: 'test' },
];

// GET /v1/models
app.get('/v1/models', (req, res) => {
  res.json({ object: 'list', data: mockModels });
});

// POST /v1/chat/completions
app.post('/v1/chat/completions', (req, res) => {
  const { messages, stream } = req.body;
  const lastMessage = messages?.[messages.length - 1]?.content || '';

  let responseContent = `Mock response to: "${lastMessage.substring(0, 50)}..."`;

  if (lastMessage.toLowerCase().includes('memory')) {
    responseContent = 'I have processed your memory-related request.';
  } else if (lastMessage.toLowerCase().includes('error')) {
    responseContent = 'Simulated error response for testing.';
  } else if (lastMessage.toLowerCase().includes('hello')) {
    responseContent = 'Hello! This is a mock AI response for testing purposes.';
  }

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const words = responseContent.split(' ');
    let i = 0;

    const sendChunk = () => {
      if (i < words.length) {
        res.write(
          `data: ${JSON.stringify({
            id: 'mock-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'mock-llm-model',
            choices: [{ index: 0, delta: { content: words[i] + ' ' }, finish_reason: null }],
          })}\n\n`
        );
        i++;
        setTimeout(sendChunk, 50);
      } else {
        res.write(
          `data: ${JSON.stringify({
            id: 'mock-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'mock-llm-model',
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        res.end();
      }
    };

    sendChunk();
  } else {
    res.json({
      id: 'mock-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'mock-llm-model',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: responseContent },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
  }
});

// POST /v1/embeddings
app.post('/v1/embeddings', (req, res) => {
  const { input } = req.body;
  const inputs = Array.isArray(input) ? input : [input];

  res.json({
    object: 'list',
    data: inputs.map((_, index) => ({
      object: 'embedding',
      index,
      embedding: Array(1536)
        .fill(0)
        .map(() => Math.random() * 2 - 1),
    })),
    model: 'mock-embedding-model',
    usage: { prompt_tokens: inputs.length * 10, total_tokens: inputs.length * 10 },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 1234;
app.listen(PORT, () => {
  console.log(`LM Studio Mock Server running on port ${PORT}`);
});
