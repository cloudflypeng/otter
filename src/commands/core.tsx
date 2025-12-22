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
        <Box borderStyle="round" borderColor="red" padding={1}>
          <Text color="red">Otter Core is stopped.</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1} width={50}>
        <Box justifyContent="space-between">
          <Text color="green" bold>Otter Core is running</Text>
          <Text color="gray">Press 'q' to exit</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Box>
            <Box width={12}><Text>PID:</Text></Box>
            <Text color="blue">{coreStatus.pid}</Text>
          </Box>
          <Box>
            <Box width={12}><Text>Version:</Text></Box>
            <Text color="yellow">{coreStatus.version}</Text>
          </Box>
          <Box>
            <Box width={12}><Text>Memory:</Text></Box>
            <Text color="cyan">{formatSize(coreStatus.memory || 0)}</Text>
          </Box>
        </Box>

        <Box marginTop={1} borderStyle="single" borderColor="gray" flexDirection="column">
          <Box>
            <Box width={12}><Text>Active Sub:</Text></Box>
            <Text color="magenta">{subInfo?.active || 'None'}</Text>
          </Box>
          <Box>
            <Box width={12}><Text>Total Subs:</Text></Box>
            <Text>{subInfo?.count || 0}</Text>
          </Box>
          <Box>
            <Box width={12}><Text>Proxies:</Text></Box>
            <Text>{proxyCount}</Text>
          </Box>
        </Box>

        <Box marginTop={1} flexDirection="row" justifyContent="space-around">
          <Box flexDirection="column" alignItems="center">
            <Text>Upload</Text>
            <Text color="green">↑ {formatSpeed(traffic.up)}</Text>
          </Box>
          <Box flexDirection="column" alignItems="center">
            <Text>Download</Text>
            <Text color="green">↓ {formatSpeed(traffic.down)}</Text>
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
