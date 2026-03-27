import React from 'react';
import { Box, Text } from 'ink';
import type { Block, ClaudeBlock } from '../core/types.js';

interface BlockItemProps {
  block: Block;
  summary?: string;
  isFocused: boolean;
  height: number; // interior row count, pre-calculated proportionally
}

function getColor(type: Block['type']): string {
  switch (type) {
    case 'system': return 'blue';
    case 'user': return 'green';
    case 'claude': return 'yellow';
  }
}

function getLabel(type: Block['type']): string {
  switch (type) {
    case 'system': return 'System';
    case 'user': return 'User';
    case 'claude': return 'Claude';
  }
}

export function BlockItem({ block, summary, isFocused, height }: BlockItemProps) {
  const color = getColor(block.type);
  const label = getLabel(block.type);

  // 블록 전체 행 수: top border(1) + interior(height) + bottom border(1)
  const totalRows = height + 2;
  // 중앙 행 인덱스 (0-based)
  const centerRow = Math.floor((totalRows - 1) / 2);

  const rawText = summary ?? block.content;
  const firstLine = rawText.split('\n')[0] ?? rawText;
  const truncated = firstLine.length > 60
    ? firstLine.slice(0, 57) + '...'
    : firstLine;

  const claudeBlock = block.type === 'claude' ? (block as ClaudeBlock) : null;

  // Right-side labels for each row
  function rightLabel(i: number): React.ReactNode {
    if (i === 0) {
      return <Text bold color={color}>{`${label} (${block.tokens.toLocaleString()} tokens)`}</Text>;
    }
    if (i === 1) {
      return <Text>{truncated}</Text>;
    }
    if (claudeBlock && i === 2 && claudeBlock.fileChanges.length > 0) {
      return (
        <Box flexDirection="row">
          {claudeBlock.fileChanges.map((fc, fi) => (
            <Box key={fi} flexDirection="row">
              <Text>{fc.path + ' '}</Text>
              <Text color="green">{'+' + fc.added}</Text>
              <Text>{' '}</Text>
              <Text color="red">{'-' + fc.removed}</Text>
              <Text>{fi < claudeBlock.fileChanges.length - 1 ? ' | ' : ''}</Text>
            </Box>
          ))}
        </Box>
      );
    }
    if (claudeBlock && i === (claudeBlock.fileChanges.length > 0 ? 3 : 2)) {
      return (
        <Text dimColor>{`Tools: ${claudeBlock.toolCallCount} | Thinking: ${claudeBlock.thinkingTokens.toLocaleString()} tokens`}</Text>
      );
    }
    return null;
  }

  // User 블록: 박스 없이 초록색 한 줄로 표시
  if (block.type === 'user') {
    return (
      <Box flexDirection="row">
        <Text>{isFocused ? '> ' : '  '}</Text>
        <Text color="green" bold>{'● '}</Text>
        <Text color="green">{`User: ${truncated}`}</Text>
        <Text color="green" dimColor>{` (${block.tokens.toLocaleString()} tokens)`}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Top border (row 0) */}
      <Box flexDirection="row">
        <Text>{isFocused && centerRow === 0 ? '> ' : '  '}</Text>
        <Text color={color}>{'┌' + '─'.repeat(10) + '┐'}</Text>
        <Text>{'    '}</Text>
        {rightLabel(0)}
      </Box>

      {/* Interior rows (row 1..height) */}
      {Array.from({ length: Math.max(1, height) }).map((_, i) => (
        <Box key={i} flexDirection="row">
          <Text>{isFocused && centerRow === i + 1 ? '> ' : '  '}</Text>
          <Text color={color}>{'│'}</Text>
          <Text>{'          '}</Text>
          <Text color={color}>{'│'}</Text>
          <Text>{'    '}</Text>
          {rightLabel(i + 1)}
        </Box>
      ))}

      {/* Bottom border (row height+1) */}
      <Box flexDirection="row">
        <Text>{isFocused && centerRow === height + 1 ? '> ' : '  '}</Text>
        <Text color={color}>{'└' + '─'.repeat(10) + '┘'}</Text>
      </Box>
    </Box>
  );
}
