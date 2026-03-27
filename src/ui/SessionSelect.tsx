import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { SessionInfo } from '../core/types.js';

interface SessionSelectProps {
  sessions: SessionInfo[];
  onSelect: (session: SessionInfo) => void;
  onBack: () => void;
}

const MAX_VISIBLE = 20;

export function SessionSelect({ sessions, onSelect, onBack }: SessionSelectProps) {
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 24;
  const [cursor, setCursor] = useState(0);

  const total = sessions.length;

  useInput(useCallback((input, key) => {
    if (key.upArrow) {
      setCursor((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((prev) => Math.min(total - 1, prev + 1));
      return;
    }
    if (key.return) {
      if (total > 0) {
        onSelect(sessions[cursor]!);
      }
      return;
    }
    if (key.escape || input === 'q') {
      onBack();
      return;
    }
  }, [total, cursor, sessions, onSelect, onBack]));

  if (total === 0) {
    return (
      <Box flexDirection="column" padding={1} minHeight={termHeight}>
        <Text color="yellow">No sessions found in ~/.claude/projects/</Text>
        <Text dimColor>Make sure you have Claude Code transcripts available.</Text>
        <Box marginTop={1}>
          <Text dimColor>Press ESC or q to go back</Text>
        </Box>
      </Box>
    );
  }

  // Windowed display: show up to MAX_VISIBLE items around cursor
  const visibleCount = Math.min(MAX_VISIBLE, total);
  const halfWindow = Math.floor(visibleCount / 2);
  let windowStart = Math.max(0, cursor - halfWindow);
  const windowEnd = Math.min(total, windowStart + visibleCount);
  windowStart = Math.max(0, windowEnd - visibleCount);

  const visibleSessions = sessions.slice(windowStart, windowEnd);

  return (
    <Box flexDirection="column" padding={1} minHeight={termHeight}>
      <Text bold>Select a session to visualize:</Text>
      <Text dimColor>{total} sessions found{total > MAX_VISIBLE ? ` (showing ${visibleCount})` : ''}</Text>
      <Box flexDirection="column" marginTop={1}>
        {visibleSessions.map((session, i) => {
          const globalIndex = windowStart + i;
          const isFocused = globalIndex === cursor;
          return (
            <Box key={session.id} flexDirection="row">
              <Text color={isFocused ? 'cyan' : undefined} bold={isFocused}>
                {isFocused ? '> ' : '  '}
              </Text>
              <Text color={isFocused ? 'cyan' : undefined} bold={isFocused}>
                [{session.date}] {session.firstPrompt}
              </Text>
            </Box>
          );
        })}
      </Box>
      {total > visibleCount && (
        <Box marginTop={1}>
          <Text dimColor>
            [{windowStart + 1}-{windowEnd}/{total}]
          </Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          [Up/Down] navigate  [Enter] select  [ESC/q] back
        </Text>
      </Box>
    </Box>
  );
}
