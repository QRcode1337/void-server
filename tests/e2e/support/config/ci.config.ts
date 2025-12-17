export const ciConfig = {
  appUrl: 'http://localhost:4420',
  services: {
    neo4j: {
      uri: 'bolt://localhost:4422',
      user: 'neo4j',
      password: 'testpassword',
      mock: false,
    },
    ipfs: {
      url: 'http://localhost:4423',
      gateway: 'http://localhost:4424/ipfs',
      mock: false,
    },
    lmstudio: {
      url: 'http://localhost:1234/v1',
      mock: true,
    },
  },
  timeouts: {
    page: 60000,
    api: 20000,
    element: 15000,
  },
};
