import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { ClashAPI } from '../utils/api';

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ConnectionsApp = () => {
  const { exit } = useApp();
  const [connections, setConnections] = useState<any[]>([]);
  const [info, setInfo] = useState<any>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const data = await ClashAPI.getConnections();
    if (data) {
      // Sort by start time (newest first)
      const sorted = (data.connections || []).sort((a: any, b: any) => {
        return new Date(b.start).getTime() - new Date(a.start).getTime();
      });
      setConnections(sorted);
      setInfo({
        downloadTotal: data.downloadTotal,
        uploadTotal: data.uploadTotal,
      });
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, []);

  useInput(async (input, key) => {
    if (input === 'q' || key.escape) {
      exit();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(connections.length - 1, prev + 1));
    }

    if (input === 'x') {
      if (connections.length === 0) return;
      const conn = connections[selectedIndex];
      setMessage(`Closing connection to ${conn.metadata.host || conn.metadata.destinationIP}...`);
      try {
        await ClashAPI.closeConnection(conn.id);
        setMessage('Connection closed.');
        // Don't wait for refresh interval
        setTimeout(refresh, 100);
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    }

    if (input === 'X') {
      setMessage('Closing ALL connections...');
      try {
        await ClashAPI.closeAllConnections();
        setMessage('All connections closed.');
        setTimeout(refresh, 100);
      } catch (e: any) {
        setMessage(`Error: ${e.message}`);
      }
    }
  });

  const visibleRows = 15;
  let startRow = 0;
  if (selectedIndex > visibleRows / 2) {
    startRow = Math.min(selectedIndex - Math.floor(visibleRows / 2), connections.length - visibleRows);
  }
  startRow = Math.max(0, startRow);
  const endRow = Math.min(startRow + visibleRows, connections.length);
  const visibleConnections = connections.slice(startRow, endRow);

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="blue" flexDirection="row" justifyContent="space-between" paddingX={1} marginBottom={1}>
        <Text color="blue" bold>Active Connections: {connections.length}</Text>
        <Box>
          <Text>Total DL: <Text color="green">{formatSize(info.downloadTotal || 0)}</Text> | </Text>
          <Text>Total UL: <Text color="yellow">{formatSize(info.uploadTotal || 0)}</Text></Text>
        </Box>
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} height={visibleRows + 2}>
        <Box flexDirection="row" marginBottom={1}>
          <Box width={30}><Text underline>Host/IP</Text></Box>
          <Box width={20}><Text underline>Chains</Text></Box>
          <Box width={15}><Text underline>Rule</Text></Box>
          <Box width={15}><Text underline>Type</Text></Box>
        </Box>

        {visibleConnections.map((conn, idx) => {
          const realIndex = startRow + idx;
          const isSelected = realIndex === selectedIndex;
          const host = conn.metadata.host || conn.metadata.destinationIP;
          const chains = conn.chains.slice().reverse().join(' :: '); // Show last proxy first? No, usually first is entry.
          // Actually chains usually: [ProxyGroup, Node].
          const chainStr = conn.chains.length > 0 ? conn.chains[0] : 'DIRECT';

          return (
            <Box key={conn.id} flexDirection="row">
              <Text color={isSelected ? 'cyan' : 'white'}>{isSelected ? '› ' : '  '}</Text>
              <Box width={28}>
                <Text color={isSelected ? 'cyan' : 'white'} wrap="truncate">
                  {host}:{conn.metadata.destinationPort}
                </Text>
              </Box>
              <Box width={20}>
                <Text color="gray" wrap="truncate">{chainStr}</Text>
              </Box>
              <Box width={15}>
                <Text color="gray" wrap="truncate">{conn.rule}</Text>
              </Box>
              <Box width={15}>
                <Text color="gray">{conn.metadata.network} ({conn.metadata.type})</Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
        <Text>{message || 'Arrows: Navigate | [x]: Close Selected | [X]: Close ALL | q: Quit'}</Text>
      </Box>
    </Box>
  );
};

export const show = async () => {
  const { waitUntilExit } = render(<ConnectionsApp />);
  await waitUntilExit();
};
