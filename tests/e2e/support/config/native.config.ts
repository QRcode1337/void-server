export const nativeConfig = {
  appUrl: 'http://localhost:4401',
  services: {
    neo4j: {
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'voidserver',
      mock: false,
    },
    ipfs: {
      url: 'http://localhost:5001',
      gateway: 'http://localhost:8080/ipfs',
      mock: true,
    },
    lmstudio: {
      url: 'http://localhost:1234/v1',
      mock: true,
    },
  },
  timeouts: {
    page: 30000,
    api: 10000,
    element: 5000,
  },
};
