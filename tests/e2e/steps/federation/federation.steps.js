const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

When('I POST to {string} with empty body', async function (endpoint) {
  const response = await this.request.post(`${this.config.appUrl}${endpoint}`, {
    data: {},
  });
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

When('I POST to {string} with invalid endpoint', async function (endpoint) {
  const response = await this.request.post(`${this.config.appUrl}${endpoint}`, {
    data: { endpoint: 'http://invalid-endpoint-that-does-not-exist.local:9999' },
  });
  this.testData.lastResponse = await response.json().catch(() => ({}));
  this.testData.lastStatus = response.status();
});

Then('the response should contain a manifest', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.manifest).toBeDefined();
  expect(response.manifest.serverId).toBeDefined();
  expect(response.manifest.publicKey).toBeDefined();
  expect(response.manifest.version).toBeDefined();
  expect(response.manifest.capabilities).toBeDefined();
  expect(Array.isArray(response.manifest.capabilities)).toBe(true);
});

Then('the response should contain server identity', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.serverId).toBeDefined();
  expect(response.publicKey).toBeDefined();
  expect(response.serverId).toMatch(/^void-[a-f0-9]{8}$/);
});

Then('the response should contain federation status', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.status).toBeDefined();
  expect(response.status.serverId).toBeDefined();
  expect(response.status.publicKey).toBeDefined();
  expect(response.status.peers).toBeDefined();
  expect(typeof response.status.uptime).toBe('number');
});

Then('the response should contain a challenge', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.challenge).toBeDefined();
  expect(typeof response.challenge).toBe('string');
  expect(response.serverId).toBeDefined();
  expect(response.publicKey).toBeDefined();
});

Then('the response should contain server ID', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.serverId).toBeDefined();
  expect(response.serverId).toMatch(/^void-[a-f0-9]{8}$/);
});

Then('the response status should be {int}', async function (statusCode) {
  expect(this.testData.lastStatus).toBe(statusCode);
});

Then('the response should contain DHT status', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.nodeId).toBeDefined();
  expect(typeof response.nodeCount).toBe('number');
  expect(typeof response.bootstrapNodes).toBe('number');
  expect(typeof response.isBootstrapped).toBe('boolean');
});

// Neo4j Peer Management Steps

Then('the response should contain Neo4j peer stats', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.stats).toBeDefined();
  expect(typeof response.stats.total).toBe('number');
  expect(response.stats.byTrustLevel).toBeDefined();
});

Then('the response should contain trust graph', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(Array.isArray(response.nodes)).toBe(true);
  expect(Array.isArray(response.edges)).toBe(true);
});

When('I create a test peer {string} in Neo4j', async function (serverId) {
  const response = await this.request.post(`${this.config.appUrl}/api/federation/peers/neo4j`, {
    data: {
      serverId,
      publicKey: `TestPubKey-${serverId}`,
      endpoint: `http://${serverId}.test.local:4420`,
      version: '0.15.0',
      capabilities: ['memory', 'chat'],
      trustLevel: 'verified'
    }
  });
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
  this.testData.lastPeerId = serverId;
});

Then('the peer should exist in Neo4j', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.peer).toBeDefined();
  expect(response.peer.serverId).toBe(this.testData.lastPeerId);
});

When('I get trust score for peer {string}', async function (serverId) {
  const response = await this.request.get(`${this.config.appUrl}/api/federation/peers/neo4j/${serverId}/trust-score`);
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

Then('the response should contain trust score', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(typeof response.trustScore).toBe('number');
});

When('I block peer {string}', async function (serverId) {
  const response = await this.request.post(`${this.config.appUrl}/api/federation/peers/neo4j/${serverId}/block`, {
    data: { reason: 'E2E test block' }
  });
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

Then('the peer should be blocked', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.peer.trustLevel).toBe('blocked');
});

When('I unblock peer {string}', async function (serverId) {
  const response = await this.request.post(`${this.config.appUrl}/api/federation/peers/neo4j/${serverId}/unblock`, {
    data: {}
  });
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

Then('the peer should be unblocked', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.peer.trustLevel).toBe('unknown');
});

When('I delete peer {string} from Neo4j', async function (serverId) {
  const response = await this.request.delete(`${this.config.appUrl}/api/federation/peers/neo4j/${serverId}`);
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

When('I create trust relationship from {string} to {string}', async function (fromServerId, toServerId) {
  const response = await this.request.post(`${this.config.appUrl}/api/federation/peers/neo4j/${fromServerId}/trust-relationship`, {
    data: { targetServerId: toServerId }
  });
  this.testData.lastResponse = await response.json();
  this.testData.lastStatus = response.status();
});

Then('the trust graph should contain relationship from {string} to {string}', async function (fromServerId, toServerId) {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  const edge = response.edges.find(e => e.from === fromServerId && e.to === toServerId);
  expect(edge).toBeDefined();
  expect(edge.type).toBe('TRUSTS');
});

// Secure Communication Steps

Then('the response should contain successful crypto test', async function () {
  const response = this.testData.lastResponse;
  expect(response.success).toBe(true);
  expect(response.encryption).toBeDefined();
  expect(response.encryption.matches).toBe(true);
  expect(response.signing).toBeDefined();
  expect(response.signing.verified).toBe(true);
});
