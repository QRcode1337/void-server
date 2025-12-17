const { World, setWorldConstructor } = require('@cucumber/cucumber');
const { request } = require('@playwright/test');
const { nativeConfig } = require('./config/native.config');
const { dockerConfig } = require('./config/docker.config');
const { ciConfig } = require('./config/ci.config');

class VoidWorld extends World {
  constructor(options) {
    super(options);

    switch (options.parameters.environment) {
      case 'docker':
        this.config = dockerConfig;
        break;
      case 'ci':
        this.config = ciConfig;
        break;
      default:
        this.config = nativeConfig;
    }

    this.testData = {};
  }

  getServiceUrl(service) {
    const svc = this.config.services[service];
    return 'url' in svc ? svc.url : svc.uri;
  }

  shouldMock(service) {
    return this.config.services[service].mock || this.parameters.useMocks || false;
  }

  async apiGet(endpoint) {
    const response = await this.request.get(`${this.config.appUrl}${endpoint}`);
    return response.json();
  }

  async apiPost(endpoint, data) {
    const response = await this.request.post(`${this.config.appUrl}${endpoint}`, { data });
    return response.json();
  }

  async apiPut(endpoint, data) {
    const response = await this.request.put(`${this.config.appUrl}${endpoint}`, { data });
    return response.json();
  }

  async apiDelete(endpoint) {
    await this.request.delete(`${this.config.appUrl}${endpoint}`);
  }
}

setWorldConstructor(VoidWorld);

module.exports = { VoidWorld };
