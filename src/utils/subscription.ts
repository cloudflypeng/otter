import fs from 'fs-extra';
import path from 'path';
import { SUBSCRIPTIONS_FILE, PROFILES_DIR, CONFIG_FILE } from './paths';
import { CoreManager } from './core';
import { ConfigParser } from './parser';
import chalk from 'chalk';

export interface Subscription {
  name: string;
  url: string;
  updatedAt: string;
}

export interface SubscriptionData {
  active: string | null;
  subscriptions: Subscription[];
}

export class SubscriptionManager {
  static async init() {
    await fs.ensureDir(PROFILES_DIR);
    if (!await fs.pathExists(SUBSCRIPTIONS_FILE)) {
      const initialData: SubscriptionData = {
        active: null,
        subscriptions: []
      };
      await fs.writeJson(SUBSCRIPTIONS_FILE, initialData, { spaces: 2 });
    }
  }

  static async getData(): Promise<SubscriptionData> {
    await this.init();
    return await fs.readJson(SUBSCRIPTIONS_FILE);
  }

  static async saveData(data: SubscriptionData) {
    await fs.writeJson(SUBSCRIPTIONS_FILE, data, { spaces: 2 });
  }

  static async add(name: string, url: string) {
    const data = await this.getData();
    if (data.subscriptions.find(s => s.name === name)) {
      throw new Error(`Subscription '${name}' already exists.`);
    }

    console.log(chalk.blue(`Fetching configuration from ${url}...`));
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    let configContent = await response.text();

    // Try to parse/convert if it's not standard Clash config
    configContent = ConfigParser.parse(configContent);

    // Basic validation
    if (!configContent.includes('proxies:') && !configContent.includes('proxy-groups:')) {
      console.warn(chalk.yellow('Warning: The downloaded content does not look like a standard Clash config.'));
    }

    const profilePath = path.join(PROFILES_DIR, `${name}.yaml`);
    await fs.writeFile(profilePath, configContent);

    data.subscriptions.push({
      name,
      url,
      updatedAt: new Date().toISOString()
    });

    // If it's the first subscription, make it active
    if (!data.active) {
      data.active = name;
      await fs.copy(profilePath, CONFIG_FILE);
    }

    await this.saveData(data);
    console.log(chalk.green(`Subscription '${name}' added successfully.`));
  }

  static async remove(name: string) {
    const data = await this.getData();
    const index = data.subscriptions.findIndex(s => s.name === name);
    if (index === -1) {
      throw new Error(`Subscription '${name}' not found.`);
    }

    data.subscriptions.splice(index, 1);
    const profilePath = path.join(PROFILES_DIR, `${name}.yaml`);
    await fs.remove(profilePath);

    if (data.active === name) {
      data.active = null;
      console.warn(chalk.yellow(`Active subscription '${name}' removed. Please select another subscription.`));
    }

    await this.saveData(data);
    console.log(chalk.green(`Subscription '${name}' removed.`));
  }

  static async update(name: string) {
    const data = await this.getData();
    const sub = data.subscriptions.find(s => s.name === name);
    if (!sub) {
      throw new Error(`Subscription '${name}' not found.`);
    }

    console.log(chalk.blue(`Updating subscription '${name}' from ${sub.url}...`));
    const response = await fetch(sub.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    let configContent = await response.text();

    // Try to parse/convert
    configContent = ConfigParser.parse(configContent);
    sub.updatedAt = new Date().toISOString();
    await this.saveData(data);
    console.log(chalk.green(`Subscription '${name}' updated.`));

    if (data.active === name) {
      await this.apply(name);
    }
  }

  static async use(name: string) {
    const data = await this.getData();
    const sub = data.subscriptions.find(s => s.name === name);
    if (!sub) {
      throw new Error(`Subscription '${name}' not found.`);
    }

    await this.apply(name);

    data.active = name;
    await this.saveData(data);
    console.log(chalk.green(`Switched to subscription '${name}'.`));
  }

  static async apply(name: string) {
    const profilePath = path.join(PROFILES_DIR, `${name}.yaml`);
    if (!await fs.pathExists(profilePath)) {
      throw new Error(`Profile file for '${name}' not found.`);
    }

    await fs.copy(profilePath, CONFIG_FILE);

    if (await CoreManager.isRunning()) {
      console.log(chalk.blue('Restarting core to apply changes...'));
      await CoreManager.stop();
      await CoreManager.start();
    }
  }

  static async list() {
    const data = await this.getData();
    if (data.subscriptions.length === 0) {
      console.log('No subscriptions found.');
      return;
    }

    console.log(chalk.bold('Subscriptions:'));
    data.subscriptions.forEach(sub => {
      const isActive = data.active === sub.name;
      const prefix = isActive ? chalk.green('* ') : '  ';
      const name = isActive ? chalk.green(sub.name) : sub.name;
      console.log(`${prefix}${name} (${sub.url}) - Updated: ${sub.updatedAt}`);
    });
  }
}
