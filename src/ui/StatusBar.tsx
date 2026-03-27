import React from 'react';
import { Box, Text } from 'ink';
import { renderProgressBar } from '../core/metrics.js';

interface StatusBarProps {
  totalTokens: number;
  maxContextTokens: number;
}

export function StatusBar({ totalTokens, maxContextTokens }: StatusBarProps) {
  const bar = renderProgressBar(totalTokens, maxContextTokens);
  const sep = '='.repeat(60);

  return (
    <Box flexDirection="column">
      <Text>{sep}</Text>
      <Text>{bar}</Text>
      <Text>{sep}</Text>
    </Box>
  );
}
