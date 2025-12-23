import React, { useState, useEffect } from 'react';
import { render, Text, Box, useApp, useInput, useStdout } from 'ink';
import { CoreManager } from '../utils/core';
import { ClashAPI } from '../utils/api';
import { SubscriptionManager } from '../utils/subscription';
import { LOG_FILE, SMART_LOG_FILE, SMART_PID_FILE } from '../utils/paths';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import * as system from './system';
import { TrafficGraph } from '../components/TrafficGraph';

const formatSpeed = (bytes: number) => {
  if (bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ProgressBar = ({ percent = 0, width = 20, color = 'green' }: { percent?: number, width?: number, color?: string }) => {
  const safePercent = Math.min(1, Math.max(0, percent));
  const completed = Math.floor(safePercent * width);
  const remaining = width - completed;
  return (
    <Text>
      <Text color={color}>{'█'.repeat(completed)}</Text>
      <Text color="gray">{'░'.repeat(remaining)}</Text>
    </Text>
  );
};

const getSpeedPercent = (bytes: number) => {
  if (bytes <= 0) return 0;
  const MAX_SPEED = 10 * 1024 * 1024; // 10MB/s
  // Linear scale
  const p = bytes / MAX_SPEED;
  return Math.min(1, p);
};

const startSmartPilot = async () => {
  // Check if already running
  if (await fs.pathExists(SMART_PID_FILE)) {
    try {
      const pid = parseInt(await fs.readFile(SMART_PID_FILE, 'utf-8'), 10);
      // Check if process exists
      process.kill(pid, 0);
      console.log('Smart Pilot is already running.');
      return;
    } catch (e) {
      // Process doesn't exist, remove stale PID file
      await fs.remove(SMART_PID_FILE);
    }
  }

  await fs.ensureFile(SMART_LOG_FILE);
  const logFd = await fs.open(SMART_LOG_FILE, 'a');

  const child = spawn(process.argv[0] || 'bun', [process.argv[1] || '', 'smart'], {
    detached: true,
    stdio: ['ignore', logFd, logFd]
  }) as any;

  if (child.pid) {
    await fs.writeFile(SMART_PID_FILE, child.pid.toString());
    child.unref();
    console.log(`Smart Pilot started with PID ${child.pid}`);
  } else {
    console.error('Failed to start Smart Pilot');
  }
};

const stopSmartPilot = async () => {
  if (await fs.pathExists(SMART_PID_FILE)) {
    const pid = parseInt(await fs.readFile(SMART_PID_FILE, 'utf-8'), 10);
    if (!isNaN(pid)) {
      try {
        process.kill(pid);
        console.log('Smart Pilot stopped.');
      } catch (e) {
        // Process might be already gone
      }
    }
    await fs.remove(SMART_PID_FILE);
  }
};

export const start = async (options: { smart?: boolean } = {}) => {
  try {
    await CoreManager.start();
    if (options.smart) {
      await startSmartPilot();
    }
    await system.on();
  } catch (error: any) {
    console.error('Error starting core:', error.message);
  }
};

export const stop = async () => {
  try {
    const isProxyEnabled = await system.getSystemProxyStatus();
    if (isProxyEnabled) {
      console.log('System proxy is enabled. Disabling it...');
      await system.off();
    }
    await stopSmartPilot();
    await CoreManager.stop();
  } catch (error: any) {
    console.error('Error stopping core:', error.message);
  }
};

export const status = async () => {
  const StatusApp = () => {
    const { exit } = useApp();
    const { stdout } = useStdout();
    const [width, setWidth] = useState(stdout.columns);
    const [coreStatus, setCoreStatus] = useState<any>(null);
    const [traffic, setTraffic] = useState({ up: 0, down: 0 });
    const [history, setHistory] = useState<{ up: number[], down: number[] }>({ up: [], down: [] });
    const [subInfo, setSubInfo] = useState<{ active: string | null, count: number } | null>(null);
    const [proxyCount, setProxyCount] = useState<number>(0);

    useInput((input, key) => {
      if (key.escape || input === 'q' || (key.ctrl && input === 'c')) {
        exit();
      }
    });

    useEffect(() => {
      const onResize = () => setWidth(stdout.columns);
      stdout.on('resize', onResize);
      return () => {
        stdout.off('resize', onResize);
      };
    }, [stdout]);

    // Calculate dynamic graph width (terminal width - padding)
    // Padding: marginLeft(2) + padding(1) + border(2) approx 6-8 chars
    const graphWidth = Math.max(20, Math.min(width - 8, 120));

    useEffect(() => {
      let ws: WebSocket | null = null;

      const fetchData = async () => {
        const s = await CoreManager.getStatus();
        setCoreStatus(s);

        if (s.running) {
          // Subs
          try {
            const subs = await SubscriptionManager.getData();
            setSubInfo({ active: subs.active, count: subs.subscriptions.length });
          } catch (e) { }

          // Proxies
          try {
            const p = await ClashAPI.getProxies();
            if (p && p.proxies) {
              setProxyCount(Object.keys(p.proxies).length);
            }
          } catch (e) { }

          // Traffic WS
          try {
            const wsUrl = await ClashAPI.getTrafficUrl();
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
              const data = JSON.parse(event.data as string);
              setTraffic(data);
              setHistory(prev => {
                // Keep enough history for wide screens
                const newUp = [...prev.up, data.up].slice(-120);
                const newDown = [...prev.down, data.down].slice(-120);
                return { up: newUp, down: newDown };
              });
            };
          } catch (e) { }
        }
      };

      fetchData();

      // Poll core status
      const interval = setInterval(async () => {
        const s = await CoreManager.getStatus();
        setCoreStatus(s);
      }, 2000);

      return () => {
        clearInterval(interval);
        if (ws) ws.close();
      };
    }, []);

    if (!coreStatus) return <Text>Loading status...</Text>;

    if (!coreStatus.running) {
      return (
        <Box padding={1}>
          <Text color="red">● Otter Core is stopped.</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>● Otter Status</Text>
          <Text color="gray">  (Press 'q' to exit)</Text>
        </Box>

        {/* System Info */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color="blue" bold>System</Text>
          <Box marginLeft={2}>
            <Box width={12}><Text>PID</Text></Box>
            <Text color="gray">{coreStatus.pid}</Text>
          </Box>
          <Box marginLeft={2}>
            <Box width={12}><Text>Version</Text></Box>
            <Text color="gray">{coreStatus.version}</Text>
          </Box>
          <Box marginLeft={2}>
            <Box width={12}><Text>Memory</Text></Box>
            <Text color="gray">{formatSize(coreStatus.memory || 0)}</Text>
          </Box>
        </Box>

        {/* Configuration */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color="magenta" bold>Configuration</Text>
          <Box marginLeft={2}>
            <Box width={12}><Text>Profile</Text></Box>
            <Text color="gray">{subInfo?.active || 'Default'}</Text>
          </Box>
          <Box marginLeft={2}>
            <Box width={12}><Text>Proxies</Text></Box>
            <Text color="gray">{proxyCount} nodes</Text>
          </Box>
        </Box>

        {/* Network Traffic */}
        <Box flexDirection="column">
          <Text color="green" bold>Network Traffic</Text>

          <Box marginLeft={2} marginTop={1} flexDirection="column">
            {/* Upload Section */}
            <Box flexDirection="column" marginBottom={1}>
              <Box flexDirection="row" width={graphWidth} justifyContent="space-between" marginBottom={0}>
                <Text>Upload</Text>
                <Text color="yellow">{formatSpeed(traffic.up)}</Text>
              </Box>
              <TrafficGraph data={history.up} width={graphWidth} height={4} color="yellow" />
            </Box>

            {/* Download Section */}
            <Box flexDirection="column">
              <Box flexDirection="row" width={graphWidth} justifyContent="space-between" marginBottom={0}>
                <Text>Download</Text>
                <Text color="green">{formatSpeed(traffic.down)}</Text>
              </Box>
              <TrafficGraph data={history.down} width={graphWidth} height={4} color="green" />
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  const { waitUntilExit } = render(<StatusApp />);
  await waitUntilExit();
};
export const log = async () => {
  if (!await fs.pathExists(LOG_FILE)) {
    console.log('No log file found.');
    return;
  }
  console.log(`Tailing logs from ${LOG_FILE}...`);
  const tail = spawn('tail', ['-f', LOG_FILE], { stdio: 'inherit' });

  // Handle exit
  process.on('SIGINT', () => {
    tail.kill();
    process.exit();
  });
};
