module.exports = {
  dockerConfig: {
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
        url: 'http://host.docker.internal:1234/v1',
        mock: true,
      },
    },
    timeouts: {
      page: 45000,
      api: 15000,
      element: 10000,
    },
  },
};
