import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';
import { Page, BrowserContext, APIRequestContext } from '@playwright/test';
import { nativeConfig } from './config/native.config';
import { dockerConfig } from './config/docker.config';
import { ciConfig } from './config/ci.config';

export interface VoidWorldParameters {
  appUrl: string;
  environment: 'native' | 'docker' | 'ci';
  useMocks?: boolean;
}

export type TestConfig = typeof nativeConfig;

export class VoidWorld extends World<VoidWorldParameters> {
  page!: Page;
  context!: BrowserContext;
  request!: APIRequestContext;
  config: TestConfig;
  testData: Record<string, unknown> = {};

  constructor(options: IWorldOptions<VoidWorldParameters>) {
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
  }

  getServiceUrl(service: 'neo4j' | 'ipfs' | 'lmstudio'): string {
    const svc = this.config.services[service];
    return 'url' in svc ? svc.url : svc.uri;
  }

  shouldMock(service: 'neo4j' | 'ipfs' | 'lmstudio'): boolean {
    return this.config.services[service].mock || this.parameters.useMocks || false;
  }

  async apiGet<T>(endpoint: string): Promise<T> {
    const response = await this.request.get(`${this.config.appUrl}${endpoint}`);
    return response.json();
  }

  async apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await this.request.post(`${this.config.appUrl}${endpoint}`, {
      data,
    });
    return response.json();
  }

  async apiPut<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await this.request.put(`${this.config.appUrl}${endpoint}`, {
      data,
    });
    return response.json();
  }

  async apiDelete(endpoint: string): Promise<void> {
    await this.request.delete(`${this.config.appUrl}${endpoint}`);
  }
}

setWorldConstructor(VoidWorld);
