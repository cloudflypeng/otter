import yaml from 'js-yaml';

interface Proxy {
  name: string;
  type: string;
  server: string;
  port: number;
  [key: string]: any;
}

export class ConfigParser {
  static parse(content: string): string {
    // 1. Check if it's already YAML
    try {
      const parsed = yaml.load(content) as any;
      if (parsed && (parsed.proxies || parsed['proxy-groups'])) {
        return content;
      }
    } catch (e) { }

    // 2. Try Base64 decode
    let decoded = content;
    try {
      const clean = content.trim();
      // Simple check if it looks like base64 (no spaces, valid chars)
      if (!clean.includes(' ') && /^[a-zA-Z0-9+/=]+$/.test(clean)) {
        decoded = atob(clean);
      }
    } catch (e) {
      // If decode fails, continue with original content
    }

    const lines = decoded.split(/\r?\n/).filter(l => l.trim() !== '');
    const proxies: Proxy[] = [];

    for (const line of lines) {
      const l = line.trim();
      if (l.startsWith('vmess://')) {
        const p = this.parseVmess(l);
        if (p) proxies.push(p);
      } else if (l.startsWith('ss://')) {
        const p = this.parseSS(l);
        if (p) proxies.push(p);
      } else if (l.startsWith('trojan://')) {
        const p = this.parseTrojan(l);
        if (p) proxies.push(p);
      }
    }

    if (proxies.length === 0) {
      return content;
    }

    // Construct Clash Config
    const config = {
      port: 7890,
      'socks-port': 7891,
      'mixed-port': 7890,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'info',
      'external-controller': '127.0.0.1:9090',
      proxies: proxies,
      'proxy-groups': [
        {
          name: 'Proxy',
          type: 'select',
          proxies: ['Auto', ...proxies.map(p => p.name)]
        },
        {
          name: 'Auto',
          type: 'url-test',
          url: 'http://www.gstatic.com/generate_204',
          interval: 300,
          proxies: proxies.map(p => p.name)
        }
      ],
      rules: [
        'MATCH,Proxy'
      ]
    };

    return yaml.dump(config);
  }

  private static parseVmess(url: string): Proxy | null {
    try {
      const b64 = url.slice(8);
      const jsonStr = atob(b64);
      const config = JSON.parse(jsonStr);

      return {
        name: config.ps || 'vmess',
        type: 'vmess',
        server: config.add,
        port: parseInt(config.port),
        uuid: config.id,
        alterId: parseInt(config.aid || '0'),
        cipher: 'auto',
        tls: config.tls === 'tls',
        servername: config.host || '',
        network: config.net || 'tcp',
        'ws-opts': config.net === 'ws' ? {
          path: config.path || '/',
          headers: {
            Host: config.host || ''
          }
        } : undefined
      };
    } catch (e) {
      return null;
    }
  }

  private static parseSS(url: string): Proxy | null {
    try {
      let raw = url.slice(5);
      let name = 'ss';
      const hashIndex = raw.indexOf('#');
      if (hashIndex !== -1) {
        name = decodeURIComponent(raw.substring(hashIndex + 1));
        raw = raw.substring(0, hashIndex);
      }

      let method, password, server, port;

      if (raw.includes('@')) {
        // SIP002: userinfo@host:port
        const atIndex = raw.lastIndexOf('@');
        const userInfoB64 = raw.substring(0, atIndex);
        const hostPort = raw.substring(atIndex + 1);

        // userInfoB64 decodes to method:password
        const userInfo = atob(userInfoB64);
        [method, password] = userInfo.split(':');
        [server, port] = hostPort.split(':');
      } else {
        // Legacy: base64(method:password@host:port)
        const decoded = atob(raw);
        // method:password@host:port
        const atIndex = decoded.lastIndexOf('@');
        const userInfo = decoded.substring(0, atIndex);
        const hostPort = decoded.substring(atIndex + 1);

        [method, password] = userInfo.split(':');
        [server, port] = hostPort.split(':');
      }

      if (!server || !port) return null;

      return {
        name,
        type: 'ss',
        server,
        port: parseInt(port),
        cipher: method,
        password
      };
    } catch (e) {
      return null;
    }
  }

  private static parseTrojan(url: string): Proxy | null {
    try {
      let raw = url.slice(9);
      let name = 'trojan';
      const hashIndex = raw.indexOf('#');
      if (hashIndex !== -1) {
        name = decodeURIComponent(raw.substring(hashIndex + 1));
        raw = raw.substring(0, hashIndex);
      }

      const atIndex = raw.indexOf('@');
      const userInfo = raw.substring(0, atIndex);
      const hostPort = raw.substring(atIndex + 1);
      const [server, portStr] = hostPort.split(':');

      if (!server || !portStr) return null;

      return {
        name,
        type: 'trojan',
        server,
        port: parseInt(portStr),
        password: userInfo,
        udp: true
      };
    } catch (e) {
      return null;
    }
  }
}
