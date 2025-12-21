import { cac } from 'cac';

const cli = cac();

cli.command('sub add <url>', 'Add').action((url) => console.log('Matched sub add:', url));
// cli.command('sub <url>', 'Sub').action((url) => console.log('Matched sub:', url));

cli.help();
cli.parse(['node', 'script', 'sub', 'add', 'http://google.com']);
