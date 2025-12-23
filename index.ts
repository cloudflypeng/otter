#!/usr/bin/env bun
import { cac } from 'cac';

import * as core from './src/commands/core';
import * as proxy from './src/commands/proxy';
import * as system from './src/commands/system';
import * as ui from './src/commands/ui';
import * as subscribe from './src/commands/subscribe';
import * as menu from './src/commands/menu';
import * as test from './src/commands/test';
import * as connections from './src/commands/connections';
import * as rules from './src/commands/rules';
import { BIN_PATH } from './src/utils/paths';

const cli = cac('ot');

// Core
cli.command('up', 'Start Clash core').alias('start').action(core.start);
cli.command('down', 'Stop Clash core').alias('stop').action(core.stop);
cli.command('status', 'Check status').action(core.status);
cli.command('log', 'Show logs').action(core.log);
cli.command('conns', 'Manage connections').alias('connections').action(connections.show);
cli.command('match <url>', 'Check which rule matches the URL').action(rules.match);

// Test
cli.command('test [group]', 'Speed test proxies').action(test.test);

// Subscribe
cli.command('sub <cmd> [arg1] [arg2]', 'Manage subscriptions')
  .action((cmd, arg1, arg2) => {
    switch (cmd) {
      case 'add':
        // ot sub add <url> [name]
        subscribe.add(arg1, arg2);
        break;
      case 'rm':
      case 'remove':
        // ot sub rm <name>
        subscribe.remove(arg1);
        break;
      case 'update':
        // ot sub update <name>
        subscribe.update(arg1);
        break;
      case 'use':
        // ot sub use <name>
        subscribe.use(arg1);
        break;
      case 'ls':
      case 'list':
        // ot sub ls
        subscribe.list();
        break;
      default:
        // Check if cmd looks like a URL (shortcut)
        if (cmd.startsWith('http')) {
          subscribe.add(cmd, 'default');
        } else {
          console.log(`Unknown sub command: ${cmd}`);
          console.log('Available commands: add, rm, update, use, ls');
        }
    }
  });

// Proxy
cli.command('ls', 'List proxies').action(proxy.list);
cli.command('use [node]', 'Switch node')
  .option('-g, --global <index>', 'Select by global index')
  .option('-p, --proxy <index>', 'Select by proxy index')
  .action(proxy.use);
// cli.command('test', 'Test latency').action(proxy.test); // Replaced by src/commands/test.ts
cli.command('best', 'Select best node').action(proxy.best);

// System
cli.command('on', 'Enable system proxy').action(system.on);
cli.command('off', 'Disable system proxy').action(system.off);
cli.command('shell', 'Enable proxy for current shell').action(system.shell);
cli.command('mode [mode]', 'Get or set proxy mode (Rule/Global/Direct)').action(system.mode);

// UI
cli.command('ui', 'Launch TUI').action(ui.ui);

cli.command('path', 'Show binary path').action(() => {
  console.log(BIN_PATH);
});

cli.command('version', 'Show version').action(async () => {
  const packageJson = JSON.parse(await Bun.file('./package.json').text());
  console.log(`otter version: ${packageJson.version}`);
});

cli.help((sections) => {
  // Filter out the default 'Commands' section
  const otherSections = sections.filter(s => s.title !== 'Commands');

  const groups = {
    'Core Commands': [] as any[],
    'Subscription Commands': [] as any[],
    'Proxy Commands': [] as any[],
    'System Commands': [] as any[],
    'UI Commands': [] as any[],
    'Misc': [] as any[]
  };

  cli.commands.forEach(cmd => {
    const name = cmd.name.split(' ')[0] || '';
    if (['up', 'down', 'status', 'log', 'start', 'stop', 'conns'].includes(name)) {
      groups['Core Commands'].push(cmd);
    } else if (name === 'sub') {
      groups['Subscription Commands'].push(cmd);
    } else if (['ls', 'use', 'test', 'best', 'match'].includes(name)) {
      groups['Proxy Commands'].push(cmd);
    } else if (['on', 'off', 'shell', 'mode'].includes(name)) {
      groups['System Commands'].push(cmd);
    } else if (name === 'ui') {
      groups['UI Commands'].push(cmd);
    } else {
      groups['Misc'].push(cmd);
    }
  });

  const formatCmd = (cmd: any) => {
    const name = cmd.rawName;
    const desc = cmd.description;
    const padding = ' '.repeat(Math.max(0, 30 - name.length));
    return `  ${name}${padding}${desc}`;
  };

  const newSections = [...otherSections];

  // Insert grouped commands
  Object.entries(groups).forEach(([title, cmds]) => {
    if (cmds.length > 0) {
      newSections.push({
        title,
        body: cmds.map(formatCmd).join('\n')
      });
    }
  });

  // Sort sections to put Usage first, then groups, then Options
  // Actually 'Usage' is usually first in otherSections.
  // We want to insert our groups between Usage and Options if possible, 
  // but simply appending them works too as Options is usually last.
  // Let's just return our constructed array.

  return newSections;
});

const run = async () => {
  // If no args provided, show menu
  if (process.argv.length === 2) {
    const action = await menu.show();
    switch (action) {
      case 'start':
        await core.start();
        break;
      case 'stop':
        await core.stop();
        break;
      case 'status':
        await core.status();
        break;
      case 'ui':
        await ui.ui();
        break;
      case 'quit':
        process.exit(0);
        break;
    }
  } else {
    cli.parse();
  }
};

run();
