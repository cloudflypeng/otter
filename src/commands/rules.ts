import { ClashAPI } from '../utils/api';
import chalk from 'chalk';

interface Rule {
  type: string;
  payload: string;
  proxy: string;
  size?: number;
}

export const match = async (urlOrHost: string) => {
  if (!urlOrHost) {
    console.error(chalk.red('Please provide a URL or hostname.'));
    return;
  }

  // Clean input to get hostname
  let hostname = urlOrHost;
  try {
    if (!hostname.startsWith('http')) {
      hostname = 'http://' + hostname;
    }
    hostname = new URL(hostname).hostname;
  } catch (e) {
    console.error(chalk.red('Invalid URL or hostname.'));
    return;
  }

  console.log(chalk.blue(`Analyzing rules for: ${chalk.bold(hostname)}`));

  const config = await ClashAPI.getConfigs();
  if (config && config.mode === 'Global') {
    console.log(chalk.yellow('Warning: System is in Global mode. All traffic goes to GLOBAL/Proxy.'));
  }

  const baseUrl = await (ClashAPI as any).getBaseUrl();
  const headers = await (ClashAPI as any).getHeaders();

  let rules: Rule[] = [];
  try {
    const res = await fetch(`${baseUrl}/rules`, { headers });
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json() as { rules: Rule[] };
    rules = data?.rules || [];
  } catch (e: any) {
    console.error(chalk.red(`Failed to fetch rules: ${e.message}`));
    return;
  }

  console.log(chalk.gray(`Loaded ${rules.length} rules.`));

  let matchedRule: Rule | null = null;

  for (const rule of rules) {
    const type = rule.type.toLowerCase();
    const payload = rule.payload;
    const lowerHost = hostname.toLowerCase();
    const lowerPayload = payload.toLowerCase();

    let isMatch = false;

    switch (type) {
      case 'domain':
        isMatch = lowerHost === lowerPayload;
        break;
      case 'domainsuffix':
      case 'domain-suffix':
        isMatch = lowerHost === lowerPayload || lowerHost.endsWith('.' + lowerPayload);
        break;
      case 'domainkeyword':
      case 'domain-keyword':
        isMatch = lowerHost.includes(lowerPayload);
        break;
      case 'match':
        isMatch = true;
        break;
      case 'geoip':
      case 'ip-cidr':
      case 'ip-cidr6':
        // Cannot match IP rules without DNS resolution
        // We skip them but maybe log a warning if verbose
        break;
      default:
        break;
    }

    if (isMatch) {
      matchedRule = rule;
      break; // Clash uses first match
    }
  }

  if (matchedRule) {
    console.log('');
    console.log(chalk.green('✔ Match Found!'));
    console.log('─'.repeat(30));
    console.log(`Type:    ${chalk.cyan(matchedRule.type)}`);
    console.log(`Payload: ${chalk.yellow(matchedRule.payload || '(Final)')}`);
    console.log(`Proxy:   ${chalk.magenta(matchedRule.proxy)}`);

    // Resolve Proxy Details
    try {
      const proxyData = await ClashAPI.getProxies();
      if (proxyData && proxyData.proxies) {
        const proxyName = matchedRule.proxy;
        const proxyInfo = proxyData.proxies[proxyName];

        if (proxyInfo) {
          console.log(`   └─ Type: ${proxyInfo.type}`);
          if (proxyInfo.now) {
            console.log(`   └─ Now:  ${chalk.green(proxyInfo.now)}`);
          }
          // If the 'now' node is also a group, we could recurse, but one level is usually enough context
          if (proxyInfo.now && proxyData.proxies[proxyInfo.now]) {
            const nextHop = proxyData.proxies[proxyInfo.now];
            if (nextHop.type === 'Selector' || nextHop.type === 'URLTest') {
              console.log(`      └─ Next: ${chalk.green(nextHop.now)}`);
            }
          }
        }
      }
    } catch (e) {
      // Ignore proxy resolution errors
    }

    console.log('─'.repeat(30));
  } else {
    console.log('');
    console.log(chalk.red('✘ No matching rule found (and no Match rule present?).'));
    console.log('Traffic might fall through to default behavior.');
  }
};
