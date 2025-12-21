import { SubscriptionManager } from '../utils/subscription';
import chalk from 'chalk';

export const add = async (url: string, name?: string) => {
  try {
    const subName = name || new URL(url).hostname;
    await SubscriptionManager.add(subName, url);
  } catch (error: any) {
    console.error(chalk.red(`Error adding subscription: ${error.message}`));
  }
};

export const remove = async (name: string) => {
  try {
    await SubscriptionManager.remove(name);
  } catch (error: any) {
    console.error(chalk.red(`Error removing subscription: ${error.message}`));
  }
};

export const update = async (name: string) => {
  try {
    await SubscriptionManager.update(name);
  } catch (error: any) {
    console.error(chalk.red(`Error updating subscription: ${error.message}`));
  }
};

export const use = async (name: string) => {
  try {
    await SubscriptionManager.use(name);
  } catch (error: any) {
    console.error(chalk.red(`Error switching subscription: ${error.message}`));
  }
};

export const list = async () => {
  try {
    await SubscriptionManager.list();
  } catch (error: any) {
    console.error(chalk.red(`Error listing subscriptions: ${error.message}`));
  }
};
