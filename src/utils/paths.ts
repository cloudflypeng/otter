import path from 'path';
import os from 'os';

export const HOME_DIR = path.join(os.homedir(), '.otter');
export const CONFIG_FILE = path.join(HOME_DIR, 'config.yaml');
export const PID_FILE = path.join(HOME_DIR, 'otter.pid');
export const SMART_PID_FILE = path.join(HOME_DIR, 'smart.pid');
export const LOG_FILE = path.join(HOME_DIR, 'otter.log');
export const SMART_LOG_FILE = path.join(HOME_DIR, 'smart.log');
export const BIN_PATH = path.resolve(import.meta.dir, '../../bin/mihomo');
export const SUBSCRIPTIONS_FILE = path.join(HOME_DIR, 'subscriptions.json');
export const PROFILES_DIR = path.join(HOME_DIR, 'profiles');
