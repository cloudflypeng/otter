import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import { BIN_PATH, CONFIG_FILE, HOME_DIR, LOG_FILE, PID_FILE } from './paths';
import psList from 'ps-list';

const execAsync = promisify(exec);

export class CoreManager {
  static async init() {
    await fs.ensureDir(HOME_DIR);
  }

  static async isRunning(): Promise<boolean> {
    if (!await fs.pathExists(PID_FILE)) {
      return false;
    }
    const pid = parseInt(await fs.readFile(PID_FILE, 'utf-8'), 10);
    if (isNaN(pid)) return false;

    const list = await psList();
    return list.some(p => p.pid === pid);
  }

  static async start() {
    await this.init();

    if (await this.isRunning()) {
      console.log('Otter (Mihomo) is already running.');
      return;
    }

    if (!await fs.pathExists(BIN_PATH)) {
      throw new Error(`Mihomo binary not found at ${BIN_PATH}`);
    }

    // Ensure executable permission
    await fs.chmod(BIN_PATH, 0o755);

    // Check for quarantine on macOS
    if (process.platform === 'darwin') {
      try {
        await execAsync(`xattr -p com.apple.quarantine "${BIN_PATH}"`);
        // If command succeeds, the attribute exists
        console.error('\n\x1b[31mError: The Mihomo binary is quarantined by macOS.\x1b[0m');
        console.error('You need to run the following command to allow it to run:');
        console.error(`\n  \x1b[33msudo xattr -d com.apple.quarantine "${BIN_PATH}"\x1b[0m\n`);
        throw new Error('Binary is quarantined');
      } catch (e: any) {
        // If command fails (exit code 1), the attribute does not exist, which is good.
        // If it's another error, we ignore it for now.
        if (e.message === 'Binary is quarantined') throw e;
      }
    }

    // Check config
    if (!await fs.pathExists(CONFIG_FILE)) {
      console.log(`Config file not found. Creating default at ${CONFIG_FILE}...`);
      const defaultConfig = `
mixed-port: 7890
allow-lan: false
mode: rule
log-level: info
external-controller: 127.0.0.1:9090
`;
      await fs.writeFile(CONFIG_FILE, defaultConfig.trim());
    } else {
      // Check if external-controller is enabled in existing config
      const configContent = await fs.readFile(CONFIG_FILE, 'utf-8');
      if (!configContent.includes('external-controller')) {
        console.warn(`Warning: 'external-controller' not found in ${CONFIG_FILE}. API features might not work.`);
        console.warn(`Please add 'external-controller: 127.0.0.1:9090' to your config.`);
      }
    }

    // Ensure log file exists
    await fs.ensureFile(LOG_FILE);
    const logFd = await fs.open(LOG_FILE, 'a');

    console.log(`Starting Mihomo from ${BIN_PATH}...`);

    const child = spawn(BIN_PATH, ['-d', HOME_DIR], {
      detached: true,
      stdio: ['ignore', logFd, logFd]
    });

    if (child.pid) {
      await fs.writeFile(PID_FILE, child.pid.toString());
      child.unref();
      console.log(`Mihomo started with PID ${child.pid}`);
    } else {
      throw new Error('Failed to start Mihomo process');
    }
  }

  static async stop() {
    if (!await this.isRunning()) {
      console.log('Otter is not running.');
      return;
    }
    const pid = parseInt(await fs.readFile(PID_FILE, 'utf-8'), 10);
    try {
      process.kill(pid);
      console.log(`Stopped process ${pid}`);
    } catch (e) {
      console.error(`Failed to stop process ${pid}:`, e);
    }
    await fs.remove(PID_FILE);
  }

  static async getStatus() {
    const running = await this.isRunning();
    if (!running) {
      return { running: false };
    }

    const pid = parseInt(await fs.readFile(PID_FILE, 'utf-8'), 10);

    // Try to fetch version from API
    // Default external controller is 127.0.0.1:9090
    // We should parse config.yaml to find the real port, but for now assume default
    let version = 'Unknown';
    let memory = 0;

    try {
      // Using Bun's built-in fetch
      const res = await fetch('http://127.0.0.1:9090/version');
      if (res.ok) {
        const data = await res.json() as any;
        version = data.version || 'Unknown';
      }
    } catch (e) {
      version = 'API Unreachable';
    }

    // Get memory usage (RSS in Bytes)
    try {
      const { stdout } = await execAsync(`ps -o rss= -p ${pid}`);
      if (stdout) {
        memory = parseInt(stdout.trim(), 10) * 1024; // KB to Bytes
      }
    } catch (e) {
      // Fallback to 0
    }

    return {
      running: true,
      pid,
      version,
      memory
    };
  }
}
