import { ClashAPI } from '../utils/api';
import chalk from 'chalk';

export const test = async (target: string = 'Proxy') => {
  console.log(chalk.blue(`Testing latency for: ${target}...`));

  const data = await ClashAPI.getProxies();
  if (!data || !data.proxies) {
    console.error(chalk.red('Failed to fetch proxies. Is Otter running?'));
    return;
  }

  const item = data.proxies[target];
  if (!item) {
    console.error(chalk.red(`Proxy or Group '${target}' not found.`));
    const availableGroups = Object.values(data.proxies)
      .filter((p: any) => p.type === 'Selector')
      .map((p: any) => p.name)
      .join(', ');
    console.log(chalk.gray(`Available groups: ${availableGroups}`));
    return;
  }

  let nodes: string[] = [];
  if (item.all && Array.isArray(item.all)) {
    nodes = item.all;
  } else {
    // It's a single node
    nodes = [target];
  }

  console.log(chalk.bold(`Starting speed test for ${nodes.length} nodes...`));
  console.log('─'.repeat(40));

  const printResult = (name: string, delay: number | string) => {
    let delayDisplay = '';
    let nameDisplay = name;

    if (typeof delay === 'number') {
      const ms = delay;
      let color = chalk.green;
      if (ms > 400) color = chalk.yellow;
      if (ms > 1000) color = chalk.red;

      delayDisplay = color(`${ms}ms`.padEnd(8));
    } else {
      delayDisplay = chalk.gray('Timeout '.padEnd(8));
      nameDisplay = chalk.gray(name);
    }

    console.log(`${delayDisplay} ${nameDisplay}`);
  };

  // Process in batches
  const batchSize = 10;
  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);
    await Promise.all(batch.map(async (node) => {
      try {
        const res = await ClashAPI.getDelay(node);
        printResult(node, res.delay);
      } catch (e) {
        printResult(node, 'Timeout');
      }
    }));
  }

  console.log('─'.repeat(40));
  console.log(chalk.green('Test completed.'));
};
