import fs from 'fs-extra';
import yaml from 'js-yaml';
import { CONFIG_FILE } from './paths';

interface Config {
  'external-controller'?: string;
  secret?: string;
  'mixed-port'?: number;
  port?: number;
  'socks-port'?: number;
}

export class ClashAPI {
  private static async getConfig(): Promise<Config> {
    if (!await fs.pathExists(CONFIG_FILE)) {
      throw new Error('Config file not found');
    }
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    return yaml.load(content) as Config;
  }

  private static async getBaseUrl(): Promise<string> {
    const config = await this.getConfig();
    const controller = config['external-controller'] || '127.0.0.1:9090';
    return `http://${controller}`;
  }

  private static async getHeaders(): Promise<Record<string, string>> {
    const config = await this.getConfig();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.secret) {
      headers['Authorization'] = `Bearer ${config.secret}`;
    }
    return headers;
  }

  static async getProxies(): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    try {
      const res = await fetch(`${baseUrl}/proxies`, { headers });
      if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  static async switchProxy(groupName: string, nodeName: string) {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    const res = await fetch(`${baseUrl}/proxies/${encodeURIComponent(groupName)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: nodeName })
    });
    if (!res.ok) throw new Error(`Failed to switch proxy: ${res.statusText}`);
  }

  static async getDelay(nodeName: string) {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    const url = `${baseUrl}/proxies/${encodeURIComponent(nodeName)}/delay?timeout=5000&url=http://www.gstatic.com/generate_204`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to test latency: ${res.statusText}`);
    return await res.json();
  }

  static async getProxyPort(): Promise<{ http: number, socks: number, mixed: number }> {
    const config = await this.getConfig();
    return {
      http: config.port || 0,
      socks: config['socks-port'] || 0,
      mixed: config['mixed-port'] || 0
    };
  }

  static async getConfigs(): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    try {
      const res = await fetch(`${baseUrl}/configs`, { headers });
      if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  static async updateConfig(config: any) {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    const res = await fetch(`${baseUrl}/configs`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error(`Failed to update config: ${res.statusText}`);
  }

  static async getConnections(): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    try {
      const res = await fetch(`${baseUrl}/connections`, { headers });
      if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  static async closeConnection(id: string) {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    const res = await fetch(`${baseUrl}/connections/${id}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error(`Failed to close connection: ${res.statusText}`);
  }

  static async closeAllConnections() {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    const res = await fetch(`${baseUrl}/connections`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error(`Failed to close all connections: ${res.statusText}`);
  }

  static async getTrafficUrl(): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    return baseUrl.replace('http://', 'ws://') + '/traffic';
  }
}
