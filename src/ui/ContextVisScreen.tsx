import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { ContextState, ClaudeBlock } from '../core/types.js';
import { StatusBar } from './StatusBar.js';
import { BlockItem } from './BlockItem.js';

interface ContextVisScreenProps {
  state: ContextState;
  onBack: () => void;
}

export function ContextVisScreen({ state, onBack }: ContextVisScreenProps) {
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 24;

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [followMode, setFollowMode] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  const blocks = state.blocks;
  const totalBlocks = blocks.length;

  // Follow mode: auto-scroll to last block when new blocks arrive
  useEffect(() => {
    if (followMode && totalBlocks > 0) {
      setFocusedIndex(totalBlocks - 1);
    }
  }, [followMode, totalBlocks]);

  useInput(useCallback((input, key) => {
    if (key.upArrow) {
      setFollowMode(false);
      setFocusedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setFollowMode(false);
      setFocusedIndex((prev) => Math.min(totalBlocks - 1, prev + 1));
      return;
    }
    if (key.escape) {
      setFollowMode(true);
      setShowDetail(false);
      return;
    }
    if (key.return) {
      setShowDetail((prev) => !prev);
      return;
    }
    if (input === 'q') {
      onBack();
      return;
    }
  }, [totalBlocks, onBack]));

  if (totalBlocks === 0) {
    return (
      <Box flexDirection="column" minHeight={termHeight}>
        <StatusBar totalTokens={state.totalTokens} maxContextTokens={state.maxContextTokens} />
        <Box padding={1}>
          <Text dimColor>No blocks yet. Waiting for transcript data...</Text>
        </Box>
      </Box>
    );
  }

  // Windowed rendering with proportional block heights
  // Reserve ~5 lines for StatusBar (3) + footer (2)
  const reservedLines = 5;
  const availableLines = Math.max(6, termHeight - reservedLines);

  // Each block needs at least 3 lines (top border + 1 interior + bottom border)
  const MIN_BLOCK_LINES = 3;
  const maxVisibleBlocks = Math.max(1, Math.floor(availableLines / MIN_BLOCK_LINES));

  // Select blocks around focusedIndex
  const halfWindow = Math.floor(maxVisibleBlocks / 2);
  let windowStart = Math.max(0, focusedIndex - halfWindow);
  let windowEnd = Math.min(totalBlocks, windowStart + maxVisibleBlocks);
  // Adjust start if we hit the end
  windowStart = Math.max(0, windowEnd - maxVisibleBlocks);

  const windowBlocks: Array<{ block: ContextState['blocks'][number]; index: number }> = [];
  for (let i = windowStart; i < windowEnd; i++) {
    windowBlocks.push({ block: blocks[i]!, index: i });
  }

  // Proportional height calculation
  // User 블록은 1줄 고정 (박스 없음), 나머지 블록만 비례 계산
  const userBlocks = windowBlocks.filter(({ block }) => block.type === 'user');
  const boxBlocks = windowBlocks.filter(({ block }) => block.type !== 'user');

  const userLines = userBlocks.length * 2; // 각 2줄
  const borderLines = boxBlocks.length * 2; // 박스 블록만 border 있음
  const interiorLines = Math.max(boxBlocks.length || 1, availableLines - userLines - borderLines);

  const totalBoxTokens = boxBlocks.reduce((sum, { block }) => sum + block.tokens, 0);
  const blockHeights = new Map<string, number>();

  // User 블록: 높이 1 고정
  for (const { block } of userBlocks) {
    blockHeights.set(block.id, 1);
  }

  // 박스 블록: 토큰 비례 높이
  if (totalBoxTokens > 0 && boxBlocks.length > 0) {
    let assigned = 0;
    for (const { block } of boxBlocks) {
      const share = block.tokens / totalBoxTokens;
      const h = Math.max(1, Math.round(share * interiorLines));
      blockHeights.set(block.id, h);
      assigned += h;
    }
    const diff = interiorLines - assigned;
    if (diff !== 0) {
      const largest = boxBlocks.reduce((a, b) =>
        b.block.tokens > a.block.tokens ? b : a
      );
      const cur = blockHeights.get(largest.block.id)!;
      blockHeights.set(largest.block.id, Math.max(1, cur + diff));
    }
  } else {
    for (const { block } of boxBlocks) {
      blockHeights.set(block.id, 1);
    }
  }

  const focusedBlock2 = blocks[focusedIndex];
  const claudeBlock = focusedBlock2?.type === 'claude' ? (focusedBlock2 as ClaudeBlock) : null;

  // 상세보기: 전체 화면으로 전환 (블록 목록 숨김)
  if (showDetail && claudeBlock) {
    const detailText = JSON.stringify(claudeBlock.rawDetails, null, 2);
    const detailAvailableLines = termHeight - 6; // header(3) + footer(2) + margin(1)
    const detailLines = detailText.split('\n');
    const truncatedDetail = detailLines.slice(0, detailAvailableLines).join('\n');
    const hasMore = detailLines.length > detailAvailableLines;

    return (
      <Box flexDirection="column" minHeight={termHeight}>
        <StatusBar totalTokens={state.totalTokens} maxContextTokens={state.maxContextTokens} />
        <Box marginTop={1}>
          <Text bold color="yellow">{`Block #${focusedIndex + 1} Detail — ${claudeBlock.toolCallCount} tools, ${claudeBlock.tokens.toLocaleString()} tokens`}</Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text>{truncatedDetail}{hasMore ? '\n...' : ''}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>ESC back to list  q quit  [{focusedIndex + 1}/{totalBlocks}]</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" minHeight={termHeight}>
      <StatusBar totalTokens={state.totalTokens} maxContextTokens={state.maxContextTokens} />

      <Box flexDirection="column">
        {windowBlocks.map(({ block, index }) => (
          <BlockItem
            key={block.id}
            block={block}
            summary={state.summaries[block.id]}
            isFocused={index === focusedIndex}
            height={blockHeights.get(block.id) ?? 1}
          />
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {followMode ? '[FOLLOW] ' : '[MANUAL] '}
          ↑↓ navigate  ESC re-enable follow  Enter toggle detail  q back
          {' '}[{focusedIndex + 1}/{totalBlocks}]
        </Text>
      </Box>
    </Box>
  );
}
