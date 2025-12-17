/**
 * IPFS Mock for unit tests
 * Use when IPFS container is unavailable
 */

const mockPins = new Map();

const ipfsMock = {
  async checkDaemon() {
    return {
      online: true,
      peerId: 'QmMockPeerId123456789',
      addresses: ['/ip4/127.0.0.1/tcp/5001'],
    };
  },

  async pinFile(filePath, metadata = {}) {
    const mockCid = 'Qm' + Buffer.from(filePath).toString('base64').substring(0, 44);
    const pin = {
      cid: mockCid,
      name: metadata.name || 'mock-file',
      type: 'file',
      size: 1024,
      pinnedAt: new Date().toISOString(),
      gatewayUrl: `http://localhost:8080/ipfs/${mockCid}`,
    };
    mockPins.set(mockCid, pin);
    return pin;
  },

  async unpin(cid) {
    mockPins.delete(cid);
    return { success: true, cid };
  },

  async listPins() {
    return Array.from(mockPins.values());
  },

  async getStatus() {
    return {
      enabled: true,
      daemonOnline: true,
      peerId: 'QmMockPeerId123456789',
      metrics: {
        totalPins: mockPins.size,
        byType: {},
      },
    };
  },

  reset() {
    mockPins.clear();
  },
};

module.exports = ipfsMock;
