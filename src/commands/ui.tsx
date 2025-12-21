import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp, Spacer } from 'ink';
import { ClashAPI } from '../utils/api';
import { CoreManager } from '../utils/core';
import { on, off, getSystemProxyStatus } from './system';

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ProxyListStatic = ({ groups, mode }: { groups: any[], mode: string }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text>Current Mode: </Text>
        <Text color="yellow" bold>{mode.toUpperCase()}</Text>
      </Box>
      {groups.map((group) => {
        let itemIndex = 0;
        const isProxy = group.name === 'Proxy';
        const isGlobal = group.name === 'GLOBAL';

        return (
          <Box key={group.name} flexDirection="column" marginBottom={1}>
            <Text bold color="cyan">
              ┌ {group.name}
            </Text>
            {group.all.map((node: string) => {
              itemIndex++;
              const isSelected = group.now === node;
              let indexLabel = '   ';
              if (isProxy) indexLabel = `P${itemIndex}`.padEnd(4);
              else if (isGlobal) indexLabel = `G${itemIndex}`.padEnd(4);

              return (
                <Box key={node}>
                  <Text color="gray">│ </Text>
                  <Text color="gray">{indexLabel}</Text>
                  <Text color={isSelected ? 'green' : 'white'}>
                    {isSelected ? '● ' : '○ '} {node}
                  </Text>
                </Box>
              );
            })}
            <Text color="gray">└{'─'.repeat(20)}</Text>
          </Box>
        );
      })}
    </Box>
  );
};

const LSApp = ({ groups, mode }: { groups: any[], mode: string }) => {
  const { exit } = useApp();
  useEffect(() => {
    exit();
  }, []);
  return <ProxyListStatic groups={groups} mode={mode} />;
};

export const renderLS = async () => {
  const [data, config] = await Promise.all([
    ClashAPI.getProxies(),
    ClashAPI.getConfigs()
  ]);

  if (!data || !data.proxies) {
    console.log('Failed to fetch proxies. Is Otter running?');
    return;
  }

  const mode = config?.mode || 'Unknown';

  const g = Object.values(data.proxies).filter((p: any) => p.type === 'Selector');
  g.sort((a: any, b: any) => {
    if (['Proxy', 'GLOBAL'].includes(a.name)) return -1;
    if (['Proxy', 'GLOBAL'].includes(b.name)) return 1;
    return 0;
  });

  const { waitUntilExit } = render(<LSApp groups={g} mode={mode} />);
  await waitUntilExit();
};

const TuiApp = () => {
  const { exit } = useApp();
  const [proxies, setProxies] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0);
  const [status, setStatus] = useState<any>(null);
  const [mode, setMode] = useState<string>('');
  const [systemProxyEnabled, setSystemProxyEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'groups' | 'nodes'>('groups'); // Focus control

  useEffect(() => {
    const init = async () => {
      const s = await CoreManager.getStatus();
      setStatus(s);
      const sysStatus = await getSystemProxyStatus();
      setSystemProxyEnabled(sysStatus);
      if (s.running) {
        await refreshProxies();
        const c = await ClashAPI.getConfigs();
        if (c) setMode(c.mode);
      }
    };
    init();
    // Auto refresh status every 5s
    const interval = setInterval(async () => {
      const s = await CoreManager.getStatus();
      setStatus(s);
      const sysStatus = await getSystemProxyStatus();
      setSystemProxyEnabled(sysStatus);
      if (s.running) {
        const c = await ClashAPI.getConfigs();
        if (c) setMode(c.mode);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const refreshProxies = async () => {
    const data = await ClashAPI.getProxies();
    if (data && data.proxies) {
      setProxies(data.proxies);
      const g = Object.values(data.proxies).filter((p: any) => p.type === 'Selector');
      // Sort to put Proxy/GLOBAL first
      g.sort((a: any, b: any) => {
        if (['Proxy', 'GLOBAL'].includes(a.name)) return -1;
        if (['Proxy', 'GLOBAL'].includes(b.name)) return 1;
        return 0;
      });
      setGroups(g);
    }
  };

  useInput(async (input, key) => {
    if (key.escape || input === 'q') {
      exit();
      return;
    }

    if (input === 's') {
      setMessage(systemProxyEnabled ? 'Disabling System Proxy...' : 'Enabling System Proxy...');
      try {
        if (systemProxyEnabled) {
          await off(true);
        } else {
          await on(true);
        }
        const sysStatus = await getSystemProxyStatus();
        setSystemProxyEnabled(sysStatus);
        setMessage(sysStatus ? 'System Proxy Enabled' : 'System Proxy Disabled');
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
      return;
    }

    if (input === 'm') {
      const modes = ['Rule', 'Global', 'Direct'];
      const currentModeIndex = modes.findIndex(m => m.toLowerCase() === mode.toLowerCase());
      const nextMode = modes[(currentModeIndex + 1) % modes.length] || 'Rule';
      setMessage(`Switching mode to ${nextMode}...`);
      try {
        await ClashAPI.updateConfig({ mode: nextMode });
        setMode(nextMode);
        setMessage(`Mode switched to ${nextMode}`);
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
      return;
    }

    if (groups.length === 0) return;

    const currentGroup = groups[selectedGroupIndex];
    const nodes = currentGroup.all;

    if (key.tab) {
      setActiveTab(prev => prev === 'groups' ? 'nodes' : 'groups');
      return;
    }

    if (activeTab === 'groups') {
      if (key.upArrow) {
        setSelectedGroupIndex(prev => Math.max(0, prev - 1));
        setSelectedNodeIndex(0); // Reset node selection when group changes
      }
      if (key.downArrow) {
        setSelectedGroupIndex(prev => Math.min(groups.length - 1, prev + 1));
        setSelectedNodeIndex(0);
      }
      if (key.rightArrow || key.return) {
        setActiveTab('nodes');
      }
    } else {
      // Nodes tab
      if (key.upArrow) {
        setSelectedNodeIndex(prev => Math.max(0, prev - 1));
      }
      if (key.downArrow) {
        setSelectedNodeIndex(prev => Math.min(nodes.length - 1, prev + 1));
      }
      if (key.leftArrow) {
        setActiveTab('groups');
      }
      if (key.return) {
        const nodeToSelect = nodes[selectedNodeIndex];
        setMessage(`Switching ${currentGroup.name} to ${nodeToSelect}...`);
        try {
          await ClashAPI.switchProxy(currentGroup.name, nodeToSelect);
          setMessage(`Switched to ${nodeToSelect}`);
          await refreshProxies();
        } catch (e: any) {
          setMessage(`Error: ${e.message}`);
        }
      }
    }
  });

  if (!status) return <Text>Loading...</Text>;
  if (!status.running) return <Text color="red">Otter Core is not running. Run 'ot up' first.</Text>;
  if (groups.length === 0) return <Text>Loading proxies...</Text>;

  const currentGroup = groups[selectedGroupIndex];
  const nodes = currentGroup.all;

  // Scroll logic for nodes
  const visibleNodes = 15;
  let startNode = 0;
  if (selectedNodeIndex > visibleNodes / 2) {
    startNode = Math.min(selectedNodeIndex - Math.floor(visibleNodes / 2), nodes.length - visibleNodes);
  }
  startNode = Math.max(0, startNode);
  const endNode = Math.min(startNode + visibleNodes, nodes.length);
  const visibleNodeList = nodes.slice(startNode, endNode);

  return (
    <Box flexDirection="column" padding={1} height={25}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" flexDirection="row" justifyContent="space-between" paddingX={1}>
        <Text color="cyan" bold>🦦 Otter TUI</Text>
        <Box>
          <Text>SysProxy: <Text color={systemProxyEnabled ? 'green' : 'red'}>{systemProxyEnabled ? 'ON' : 'OFF'}</Text> | </Text>
          <Text>Mode: <Text color="magenta">{mode}</Text> | </Text>
          <Text>Ver: <Text color="green">{status.version}</Text> | </Text>
          <Text>Mem: <Text color="yellow">{formatSize(status.memory || 0)}</Text> | </Text>
          <Text>PID: {status.pid}</Text>
        </Box>
      </Box>

      {/* Main Content */}
      <Box flexDirection="row" flexGrow={1}>

        {/* Left Panel: Groups */}
        <Box flexDirection="column" width="30%" borderStyle="single" borderColor={activeTab === 'groups' ? 'green' : 'gray'} paddingX={1}>
          <Box marginBottom={1}>
            <Text bold underline>Proxy Groups</Text>
          </Box>
          {groups.map((g, idx) => {
            const isSelected = idx === selectedGroupIndex;
            return (
              <Box key={g.name}>
                <Text color={isSelected ? 'green' : 'white'} bold={isSelected}>
                  {isSelected ? '› ' : '  '}{g.name}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Right Panel: Nodes */}
        <Box flexDirection="column" width="70%" borderStyle="single" borderColor={activeTab === 'nodes' ? 'green' : 'gray'} paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
            <Text bold underline>Nodes in [{currentGroup.name}]</Text>
            <Text color="gray">{selectedNodeIndex + 1}/{nodes.length}</Text>
          </Box>

          {visibleNodeList.map((node: string, idx: number) => {
            const realIndex = startNode + idx;
            const isFocused = realIndex === selectedNodeIndex;
            const isActive = currentGroup.now === node;

            return (
              <Box key={node} flexDirection="row">
                <Text color={isFocused ? 'cyan' : 'white'}>
                  {isFocused ? '› ' : '  '}
                </Text>
                <Text color={isActive ? 'green' : (isFocused ? 'cyan' : 'white')}>
                  {isActive ? '● ' : '  '}
                  {node}
                </Text>
              </Box>
            );
          })}
          {nodes.length > visibleNodes && (
            <Box marginTop={1}>
              <Text color="gray">... {nodes.length - endNode} more ...</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer / Status Bar */}
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text>{message || 'Arrows: Navigate | Enter: Select | Tab: Switch Panel | [s]: SysProxy | [m]: Mode | q: Quit'}</Text>
      </Box>
    </Box>
  );
};

export const ui = async () => {
  const { waitUntilExit } = render(<TuiApp />);
  await waitUntilExit();
};
