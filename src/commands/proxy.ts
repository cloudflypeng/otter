import { ClashAPI } from '../utils/api';
import chalk from 'chalk';
import { renderLS } from './ui';

export const list = async () => {
  await renderLS();
};

export const use = async (nodeName?: string, options?: any) => {
  const data = await ClashAPI.getProxies();
  if (!data || !data.proxies) {
    console.error(chalk.red('Failed to fetch proxies.'));
    return;
  }

  const proxies = data.proxies;
  const groups = Object.values(proxies).filter((p: any) => p.type === 'Selector');

  // Helper to switch by index in a specific group
  const switchByIndex = async (groupName: string, index: number) => {
    const group = groups.find((g: any) => g.name === groupName);
    if (!group) {
      console.error(chalk.red(`Group '${groupName}' not found.`));
      return true;
    }
    if (index > 0 && index <= (group as any).all.length) {
      const node = (group as any).all[index - 1];
      try {
        await ClashAPI.switchProxy(group.name, node);
        console.log(chalk.green(`Switched [${group.name}] to '${node}'`));
      } catch (e: any) {
        console.error(chalk.red(e.message));
      }
    } else {
      console.error(chalk.red(`Index ${index} out of range for ${groupName}.`));
    }
    return true;
  };

  // Handle -p (Proxy)
  if (options?.proxy || options?.p) {
    const idx = parseInt(options.proxy || options.p);
    if (await switchByIndex('Proxy', idx)) return;
  }

  // Handle -g (GLOBAL)
  if (options?.global || options?.g) {
    const idx = parseInt(options.global || options.g);
    if (await switchByIndex('GLOBAL', idx)) return;
  }

  // Handle bare number -> Default to Proxy group
  if (nodeName && /^\d+$/.test(nodeName)) {
    const idx = parseInt(nodeName);
    if (await switchByIndex('Proxy', idx)) return;
  }

  if (!nodeName) {
    console.error(chalk.red('Please specify a node name or index.'));
    return;
  }

  // Find target node (fuzzy match)
  // We need to find which group contains this node, or if the user wants to switch a specific group
  // Usually 'use' implies switching the main selector (often 'Proxy' or 'GLOBAL' or the first one)
  // Or we can search all groups and switch where possible.

  // Strategy:
  // 1. If nodeName matches a group name, maybe they want to select that group? (Not common in 'use node')
  // 2. Search for nodeName in all groups.

  let targetNode = nodeName;
  let targetGroup: any = null;

  // Simple fuzzy search helper
  const findNode = (search: string, candidates: string[]) => {
    const lower = search.toLowerCase();
    return candidates.find(c => c.toLowerCase().includes(lower));
  };

  // Try to find a group that has this node
  // We prioritize the "Proxy" or "GLOBAL" group if it exists
  const priorityGroups = ['Proxy', 'GLOBAL', '节点选择'];

  for (const gName of priorityGroups) {
    const g = groups.find((x: any) => x.name === gName);
    if (g) {
      const match = findNode(nodeName, g.all);
      if (match) {
        targetGroup = g;
        targetNode = match;
        break;
      }
    }
  }

  // If not found in priority, search all
  if (!targetGroup) {
    for (const g of groups) {
      const match = findNode(nodeName, (g as any).all);
      if (match) {
        targetGroup = g;
        targetNode = match;
        break;
      }
    }
  }

  if (!targetGroup) {
    console.error(chalk.red(`Node '${nodeName}' not found in any selector group.`));
    return;
  }

  try {
    await ClashAPI.switchProxy(targetGroup.name, targetNode);
    console.log(chalk.green(`Switched [${targetGroup.name}] to '${targetNode}'`));
  } catch (e: any) {
    console.error(chalk.red(e.message));
  }
};

export const test = async () => {
  const data = await ClashAPI.getProxies();
  if (!data) return;

  // Find current node of the main selector
  const proxies = data.proxies;
  const groups = Object.values(proxies).filter((p: any) => p.type === 'Selector');

  // Heuristic: First group is usually the main one
  const mainGroup: any = groups.find((g: any) => ['Proxy', 'GLOBAL'].includes(g.name)) || groups[0];

  if (!mainGroup) {
    console.log('No selector group found.');
    return;
  }

  const currentNode = mainGroup.now;
  console.log(`Testing latency for ${chalk.cyan(currentNode)}...`);

  try {
    const res = await ClashAPI.getDelay(currentNode);
    console.log(chalk.green(`Latency: ${res.delay}ms`));
  } catch (e: any) {
    console.error(chalk.red('Timeout or Error'));
  }
};

export const best = async () => {
  console.log(chalk.blue('Testing Proxy group to find the best one...'));

  const data = await ClashAPI.getProxies();
  if (!data || !data.proxies) {
    console.error(chalk.red('Failed to fetch proxies. Is Otter running?'));
    return;
  }

  const proxies = data.proxies;
  // Explicitly look for 'Proxy' group
  const mainGroup: any = proxies['Proxy'];

  if (!mainGroup) {
    console.error(chalk.red("Group 'Proxy' not found."));
    return;
  }

  console.log(chalk.gray(`Testing group: ${mainGroup.name} (${mainGroup.all.length} nodes)`));

  const candidates: string[] = mainGroup.all;
  let bestNode = '';
  let minDelay = Infinity;

  // Limit concurrency
  const results = await Promise.all(candidates.map(async (node) => {
    try {
      const res = await ClashAPI.getDelay(node);
      return { node, delay: res.delay };
    } catch {
      return { node, delay: Infinity };
    }
  }));

  results.forEach(r => {
    if (r.delay < minDelay && r.delay > 0) {
      minDelay = r.delay;
      bestNode = r.node;
    }
  });

  if (bestNode) {
    console.log(chalk.green(`Best node found: ${bestNode} (${minDelay}ms)`));
    await ClashAPI.switchProxy(mainGroup.name, bestNode);
    console.log(`Switched to ${bestNode}`);
  } else {
    console.error(chalk.red('No reachable nodes found.'));
  }
};
