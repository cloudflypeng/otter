#!/usr/bin/env bun
import { cac } from 'cac';

const cli = cac('ot');

cli.command('version', 'Show version').action(async () => {
  const packageJson = JSON.parse(await Bun.file('./package.json').text());
  console.log(`otter version: ${packageJson.version}`);
});

cli.command('repo', 'open repo with vscode')
  .action(() => {
    console.log('open repo with vscode');
  });

cli.command('web', 'open web app').action(() => {
  console.log('open web app');
});

cli.help();
cli.parse();
