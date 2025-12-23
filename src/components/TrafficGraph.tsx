import React from 'react';
import { Box, Text } from 'ink';

interface TrafficGraphProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  max?: number;
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + (sizes[i] || 'B');
};

export const TrafficGraph: React.FC<TrafficGraphProps> = ({
  data,
  width = 40,
  height = 4,
  color = 'green',
  max
}) => {
  // Pad with 0s at the start if data is less than width
  const filledData = [...(new Array(Math.max(0, width - data.length)).fill(0)), ...data].slice(-width);

  // Calculate max value for scaling
  // Use a minimum max value (e.g. 1KB) to avoid flat lines on 0
  const maxValue = max || Math.max(...filledData, 1024);

  const rows = [];
  const chars = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  for (let y = height - 1; y >= 0; y--) {
    let rowStr = '';
    for (let x = 0; x < width; x++) {
      const value = filledData[x];
      const ratio = value / maxValue;
      const scaledValue = ratio * height;

      if (scaledValue >= y + 1) {
        rowStr += '█';
      } else if (scaledValue > y) {
        const remainder = scaledValue - y;
        const charIndex = Math.floor(remainder * (chars.length - 1));
        rowStr += chars[charIndex];
      } else {
        rowStr += ' ';
      }
    }
    rows.push(rowStr);
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Box flexDirection="column">
        {rows.map((row, i) => (
          <Text key={i} color={color}>{row}</Text>
        ))}
      </Box>
      <Box justifyContent="space-between" marginTop={0}>
        <Text color="gray" dimColor>0</Text>
        <Text color="gray" dimColor>{formatSize(maxValue)}</Text>
      </Box>
    </Box>
  );
};
