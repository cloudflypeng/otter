import { ClashAPI } from '../utils/api';
import { SubscriptionManager } from '../utils/subscription';
import * as system from './system';
import chalk from 'chalk';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const findBestNode = async (nodes: string[]): Promise<{ name: string, delay: number } | null> => {
  if (nodes.length === 0) return null;

  // Test up to 5 nodes concurrently to save time
  const candidates = nodes.slice(0, 5);

  const results = await Promise.all(candidates.map(async (node) => {
    try {
      const res = await ClashAPI.getDelay(node) as { delay: number };
      return { name: node, delay: res.delay };
    } catch {
      return { name: node, delay: Infinity };
    }
  }));

  // Filter valid results and sort
  const valid = results.filter(r => r.delay < 2000).sort((a, b) => a.delay - b.delay);

  if (valid.length > 0) {
    const best = valid[0];
    if (best) {
      return { name: best.name, delay: best.delay };
    }
  }
  return null;
};

export const start = async () => {
  console.log(chalk.cyan(chalk.bold('🦦 Otter Smart Pilot Initiated')));
  console.log(chalk.gray('Monitoring network health and managing failover...'));
  console.log(chalk.gray('Press Ctrl+C to stop.'));
  console.log('─'.repeat(40));

  while (true) {
    try {
      // 1. Health Check
      const data = await ClashAPI.getProxies();
      if (!data || !data.proxies) {
        console.log(chalk.red('Otter Core not reachable. Retrying in 5s...'));
        await sleep(5000);
        continue;
      }

      const proxyGroup = data.proxies['Proxy'];
      if (!proxyGroup) {
        console.log(chalk.red("Group 'Proxy' not found."));
        await sleep(10000);
        continue;
      }

      const currentNode = proxyGroup.now;
      process.stdout.write(`[${new Date().toLocaleTimeString()}] Checking ${currentNode}... `);

      let isHealthy = false;
      try {
        const res = await ClashAPI.getDelay(currentNode) as { delay: number };
        if (res.delay < 1500) {
          console.log(chalk.green(`OK (${res.delay}ms)`));
          isHealthy = true;
        } else {
          console.log(chalk.yellow(`High Latency (${res.delay}ms)`));
        }
      } catch {
        console.log(chalk.red('Timeout'));
      }

      if (isHealthy) {
        await sleep(10000); // Check every 10s if healthy
        continue;
      }

      // 2. Fallback Logic
      console.log(chalk.yellow('⚠ Connection unstable. Initiating fallback protocol...'));

      const allNodes: string[] = proxyGroup.all;

      // Regex patterns
      const regions = [
        { name: 'Hong Kong', regex: /HK|Hong Kong|香港/i },
        { name: 'Japan', regex: /JP|Japan|日本/i },
        { name: 'USA', regex: /US|USA|United States|美国/i },
      ];

      let fallbackSuccess = false;

      for (const region of regions) {
        console.log(chalk.blue(`Searching for healthy ${region.name} nodes...`));
        const regionNodes = allNodes.filter(n => region.regex.test(n));

        const best = await findBestNode(regionNodes);
        if (best) {
          console.log(chalk.green(`✔ Found ${region.name} node: ${best.name} (${best.delay}ms)`));
          await ClashAPI.switchProxy('Proxy', best.name);
          console.log(chalk.green(`Switched to ${best.name}`));
          fallbackSuccess = true;
          break;
        } else {
          console.log(chalk.gray(`✘ No healthy ${region.name} nodes found.`));
        }
      }

      if (fallbackSuccess) {
        await sleep(5000); // Wait a bit before next check
        continue;
      }

      // 3. Disaster Recovery
      console.log(chalk.red.bold('‼ All fallback regions failed. Initiating EMERGENCY UPDATE...'));

      console.log(chalk.yellow('1. Disabling System Proxy...'));
      await system.off(true); // silent

      console.log(chalk.yellow('2. Updating Subscriptions...'));
      const subData = await SubscriptionManager.getData();
      for (const sub of subData.subscriptions) {
        process.stdout.write(`Updating ${sub.name}... `);
        try {
          await SubscriptionManager.update(sub.name);
          console.log(chalk.green('Done'));
        } catch (e: any) {
          console.log(chalk.red('Failed'));
        }
      }

      console.log(chalk.yellow('3. Re-enabling System Proxy...'));
      await system.on(true);

      console.log(chalk.yellow('4. Selecting Best Node...'));
      // Simple best node selection from all nodes
      const bestAny = await findBestNode(allNodes);
      if (bestAny) {
        await ClashAPI.switchProxy('Proxy', bestAny.name);
        console.log(chalk.green(`Recovered! Switched to ${bestAny.name}`));
      } else {
        console.log(chalk.red('Recovery failed. No reachable nodes found. Retrying in 1 minute...'));
        await sleep(60000);
      }

    } catch (e: any) {
      console.error(chalk.red(`Smart Pilot Error: ${e.message}`));
      await sleep(5000);
    }
  }
};
