const http = require('http');

const MOCK_PORT = 1235;

const MOCK_MODELS = {
  object: 'list',
  data: [
    { id: 'test-model', object: 'model', owned_by: 'test', permission: [] },
  ],
};

const MOCK_COMPLETION = {
  id: 'test-completion',
  object: 'chat.completion',
  created: Date.now(),
  model: 'test-model',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Hello! I am a mock AI assistant. How can I help you today?',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 15,
    total_tokens: 25,
  },
};

let server = null;

function createMockServer() {
  return http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200);
      res.end(JSON.stringify(MOCK_MODELS));
      return;
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      // Add a small delay to simulate processing
      setTimeout(() => {
        res.writeHead(200);
        res.end(JSON.stringify(MOCK_COMPLETION));
      }, 100);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

function startMockLmStudio() {
  return new Promise((resolve, reject) => {
    server = createMockServer();
    server.listen(MOCK_PORT, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Mock LM Studio server started on port ${MOCK_PORT}`);
        resolve(server);
      }
    });
  });
}

function stopMockLmStudio() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('Mock LM Studio server stopped');
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  MOCK_PORT,
  startMockLmStudio,
  stopMockLmStudio,
};
