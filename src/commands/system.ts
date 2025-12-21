import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { ClashAPI } from '../utils/api';

const execAsync = promisify(exec);

// Helper to detect active network service on macOS
const getActiveService = async () => {
  try {
    // This is a heuristic. We look for the service associated with the default route interface.
    // 1. Get default route interface
    const { stdout: routeOut } = await execAsync('route get default | grep interface');
    const interfaceName = routeOut.split(':')[1].trim();

    // 2. Get service name for that interface
    const { stdout: servicesOut } = await execAsync('networksetup -listallhardwareports');

    // Parse output to find the service name for the interface
    // Output format:
    // Hardware Port: Wi-Fi
    // Device: en0
    // Ethernet Address: ...

    const lines = servicesOut.split('\n');
    let currentService = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('Hardware Port:')) {
        currentService = line.split(':')[1].trim();
      }
      if (line.includes(`Device: ${interfaceName}`)) {
        return currentService;
      }
    }
    return 'Wi-Fi'; // Fallback
  } catch (e) {
    return 'Wi-Fi'; // Fallback
  }
};

export const getSystemProxyStatus = async () => {
  try {
    const service = await getActiveService();
    const { stdout } = await execAsync(`networksetup -getwebproxy "${service}"`);
    return stdout.includes('Enabled: Yes');
  } catch (e) {
    return false;
  }
};

export const on = async (optionsOrSilent?: any) => {
  const silent = typeof optionsOrSilent === 'boolean' ? optionsOrSilent : false;
  try {
    const service = await getActiveService();
    const ports = await ClashAPI.getProxyPort();

    if (ports.mixed === 0 && ports.http === 0 && ports.socks === 0) {
      if (!silent) console.error(chalk.red('Could not determine proxy ports from config.'));
      return;
    }

    const httpPort = ports.http || ports.mixed;
    const socksPort = ports.socks || ports.mixed;

    if (!silent) console.log(chalk.blue(`Enabling proxy for service: ${service}`));

    if (httpPort) {
      await execAsync(`networksetup -setwebproxy "${service}" 127.0.0.1 ${httpPort}`);
      await execAsync(`networksetup -setsecurewebproxy "${service}" 127.0.0.1 ${httpPort}`);
      if (!silent) console.log(chalk.green(`HTTP/HTTPS Proxy set to 127.0.0.1:${httpPort}`));
    }

    if (socksPort) {
      await execAsync(`networksetup -setsocksfirewallproxy "${service}" 127.0.0.1 ${socksPort}`);
      if (!silent) console.log(chalk.green(`SOCKS Proxy set to 127.0.0.1:${socksPort}`));
    }

    // Turn them on
    if (httpPort) {
      await execAsync(`networksetup -setwebproxystate "${service}" on`);
      await execAsync(`networksetup -setsecurewebproxystate "${service}" on`);
    }
    if (socksPort) {
      await execAsync(`networksetup -setsocksfirewallproxystate "${service}" on`);
    }

  } catch (error: any) {
    if (!silent) {
      console.error(chalk.red(`Error enabling system proxy: ${error.message}`));
      console.error(chalk.yellow('Note: This command requires sudo privileges if not prompted.'));
    }
  }
};

export const off = async (optionsOrSilent?: any) => {
  const silent = typeof optionsOrSilent === 'boolean' ? optionsOrSilent : false;
  try {
    const service = await getActiveService();
    if (!silent) console.log(chalk.blue(`Disabling proxy for service: ${service}`));

    await execAsync(`networksetup -setwebproxystate "${service}" off`);
    await execAsync(`networksetup -setsecurewebproxystate "${service}" off`);
    await execAsync(`networksetup -setsocksfirewallproxystate "${service}" off`);

    if (!silent) console.log(chalk.green('System proxy disabled.'));
  } catch (error: any) {
    if (!silent) console.error(chalk.red(`Error disabling system proxy: ${error.message}`));
  }
};

export const shell = async () => {
  const ports = await ClashAPI.getProxyPort();
  const port = ports.http || ports.mixed || 7890;

  console.log(chalk.yellow('Copy and run the following commands in your terminal:'));
  console.log('');
  console.log(`export http_proxy=http://127.0.0.1:${port}`);
  console.log(`export https_proxy=http://127.0.0.1:${port}`);
  console.log(`export all_proxy=socks5://127.0.0.1:${port}`);
  console.log('');
  console.log(chalk.gray('# To undo:'));
  console.log('unset http_proxy https_proxy all_proxy');
};

export const mode = async (modeName?: string) => {
  if (!modeName) {
    const config = await ClashAPI.getConfigs();
    if (config) {
      console.log(`Current mode: ${chalk.green(config.mode)}`);
    } else {
      console.error(chalk.red('Failed to get config.'));
    }
    return;
  }

  const validModes = ['global', 'rule', 'direct'];
  const m = modeName.toLowerCase();
  if (!validModes.includes(m)) {
    console.error(chalk.red(`Invalid mode: ${modeName}. Valid modes: ${validModes.join(', ')}`));
    return;
  }

  // Capitalize first letter for API
  const apiMode = m.charAt(0).toUpperCase() + m.slice(1);
  try {
    await ClashAPI.updateConfig({ mode: apiMode });
    console.log(chalk.green(`Switched to ${apiMode} mode.`));
  } catch (e: any) {
    console.error(chalk.red(e.message));
  }
};
