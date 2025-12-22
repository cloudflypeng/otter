import React, { useState, useEffect } from 'react';
import { render, Text, Box, useApp, useInput } from 'ink';
import { CoreManager } from '../utils/core';
import { ClashAPI } from '../utils/api';
import { SubscriptionManager } from '../utils/subscription';
import { LOG_FILE } from '../utils/paths';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import * as system from './system';

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


export const start = async () => {
  try {
    await CoreManager.start();
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
    await CoreManager.stop();
  } catch (error: any) {
    console.error('Error stopping core:', error.message);
  }
};

export const status = async () => {
  const StatusApp = () => {
    const { exit } = useApp();
    const [coreStatus, setCoreStatus] = useState<any>(null);
    const [traffic, setTraffic] = useState({ up: 0, down: 0 });
    const [subInfo, setSubInfo] = useState<{ active: string | null, count: number } | null>(null);
    const [proxyCount, setProxyCount] = useState<number>(0);

    useInput((input, key) => {
      if (key.escape || input === 'q' || (key.ctrl && input === 'c')) {
        exit();
      }
    });

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
            <Box>
              <Box width={12}><Text>Upload</Text></Box>
              <Box width={14}><Text color="yellow">{formatSpeed(traffic.up)}</Text></Box>
              <ProgressBar percent={getSpeedPercent(traffic.up)} width={10} color="yellow" />
            </Box>

            <Box>
              <Box width={12}><Text>Download</Text></Box>
              <Box width={14}><Text color="green">{formatSpeed(traffic.down)}</Text></Box>
              <ProgressBar percent={getSpeedPercent(traffic.down)} width={10} color="green" />
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
