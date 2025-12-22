import React from 'react';
import { render, Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

const LOGO = `
   ____  __  __
  / __ \\/ /_/ /____  _____
 / / / / __/ __/ _ \\/ ___/
/ /_/ / /_/ /_/  __/ /
\\____/\\__/\\__/\\___/_/
`;

interface MenuProps {
  onSelect: (value: string) => void;
}

const Menu: React.FC<MenuProps> = ({ onSelect }) => {
  const items = [
    { label: 'Start'.padEnd(15) + 'Start Clash core & System Proxy', value: 'start' },
    { label: 'Stop'.padEnd(15) + 'Stop Clash core & Disable Proxy', value: 'stop' },
    { label: 'Status'.padEnd(15) + 'Check status & traffic', value: 'status' },
    { label: 'Dashboard'.padEnd(15) + 'Launch full TUI', value: 'ui' },
    { label: 'Quit'.padEnd(15) + 'Exit', value: 'quit' },
  ];

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green">{LOGO}</Text>
      <Text color="gray" italic>  v0.0.1</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text>
          <Text color="cyan">➤</Text> Use <Text bold>Arrow Keys</Text> to select and <Text bold>Enter</Text> to confirm
        </Text>
      </Box>

      <SelectInput
        items={items}
        onSelect={(item) => onSelect(item.value)}
        indicatorComponent={({ isSelected }) => (
          <Text color={isSelected ? 'cyan' : 'gray'}>
            {isSelected ? '➤ ' : '  '}
          </Text>
        )}
        itemComponent={({ isSelected, label }) => (
          <Text color={isSelected ? 'cyan' : 'white'}>
            {label}
          </Text>
        )}
      />

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">
          <Text>↑↓</Text> Navigate | <Text>Enter</Text> Select | <Text>Q</Text> Quit
        </Text>
      </Box>
    </Box>
  );
};

export const show = () => {
  return new Promise<string>((resolve) => {
    const { unmount } = render(<Menu onSelect={(value) => {
      unmount();
      resolve(value);
    }} />);
  });
};
