import React from "react";
import { Box, Text, useStdout } from "ink";
import type { Block, ClaudeBlock } from "../core/types.js";

interface BlockItemProps {
  block: Block;
  summary?: string;
  isFocused: boolean;
  height: number; // interior row count, pre-calculated proportionally
}

function getColor(type: Block["type"]): string {
  switch (type) {
    case "system":
      return "blue";
    case "user":
      return "green";
    case "claude":
      return "yellow";
  }
}

function getLabel(type: Block["type"]): string {
  switch (type) {
    case "system":
      return "System";
    case "user":
      return "User";
    case "claude":
      return "Claude";
  }
}

// 왼쪽 고정 영역 폭: 커서(2) + 박스(12) + 간격(4) = 18
const LEFT_FIXED_WIDTH = 18;

// CJK 문자(한글, 한자, 일본어 등)는 터미널에서 2칸을 차지함
function charWidth(code: number): number {
  // CJK Unified Ideographs, Hangul Syllables, Katakana, etc.
  if (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) || // CJK Radicals, Kangxi, Ideographic
    (code >= 0x3040 && code <= 0x33bf) || // Hiragana, Katakana, CJK Compatibility
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Unified Extension A
    (code >= 0x4e00 && code <= 0xa4cf) || // CJK Unified, Yi Syllables
    (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0xfe30 && code <= 0xfe4f) || // CJK Compatibility Forms
    (code >= 0xff01 && code <= 0xff60) || // Fullwidth Forms
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth Signs
    (code >= 0x20000 && code <= 0x2fa1f)  // CJK Extensions B-F, Compatibility Supplement
  ) {
    return 2;
  }
  return 1;
}

function displayWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    w += charWidth(ch.codePointAt(0)!);
  }
  return w;
}

function truncateToWidth(text: string, maxWidth: number): string {
  if (maxWidth <= 3) {
    let w = 0;
    let result = "";
    for (const ch of text) {
      const cw = charWidth(ch.codePointAt(0)!);
      if (w + cw > maxWidth) break;
      result += ch;
      w += cw;
    }
    return result;
  }
  if (displayWidth(text) <= maxWidth) return text;
  // Truncate to fit maxWidth - 3 (for "...") based on display width
  let w = 0;
  let result = "";
  for (const ch of text) {
    const cw = charWidth(ch.codePointAt(0)!);
    if (w + cw > maxWidth - 3) break;
    result += ch;
    w += cw;
  }
  return result + "...";
}

export function BlockItem({
  block,
  summary,
  isFocused,
  height,
}: BlockItemProps) {
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 80;
  const maxRightWidth = Math.max(10, termWidth - LEFT_FIXED_WIDTH);

  const color = getColor(block.type);
  const label = getLabel(block.type);

  // 블록 전체 행 수: top border(1) + interior(height) + bottom border(1)
  const totalRows = height + 2;
  // 중앙 행 인덱스 (0-based)
  const centerRow = Math.floor((totalRows - 1) / 2);

  const rawText = summary ?? block.content;
  const firstLine = rawText.split("\n")[0] ?? rawText;
  const truncated = truncateToWidth(firstLine, maxRightWidth);

  const claudeBlock = block.type === "claude" ? (block as ClaudeBlock) : null;

  // Right-side labels for each row
  function rightLabel(i: number): React.ReactNode {
    if (i === 0) {
      const headerText = `${label} (${block.tokens.toLocaleString()} tokens)`;
      return (
        <Text
          bold
          color={color}
        >{truncateToWidth(headerText, maxRightWidth)}</Text>
      );
    }
    if (i === 1) {
      return <Text>{truncated}</Text>;
    }
    if (claudeBlock && i === 2) {
      const totalAdded = claudeBlock.fileChanges.reduce(
        (s, fc) => s + fc.added,
        0,
      );
      const totalRemoved = claudeBlock.fileChanges.reduce(
        (s, fc) => s + fc.removed,
        0,
      );
      const changePart =
        totalAdded + totalRemoved > 0
          ? ` | Changes: +${totalAdded} -${totalRemoved}`
          : "";
      const infoText = `Tools: ${claudeBlock.toolCallCount} | Thinking: ${claudeBlock.thinkingTokens.toLocaleString()} tokens${changePart}`;
      return (
        <Text
          dimColor
        >{truncateToWidth(infoText, maxRightWidth)}</Text>
      );
    }
    return null;
  }

  // User 블록: 2줄 (┌─ top + └─ content)
  if (block.type === "user") {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text>{isFocused ? "> " : "  "}</Text>
          <Text color="green">{"┌" + "─".repeat(10) + "┐"}</Text>
          <Text>{"    "}</Text>
          <Text
            bold
            color="green"
          >{truncateToWidth(`User (${block.tokens.toLocaleString()} tokens)`, maxRightWidth)}</Text>
        </Box>
        <Box flexDirection="row">
          <Text>{"  "}</Text>
          <Text color="green">{"└" + "─".repeat(10) + "┘"}</Text>
          <Text>{"    "}</Text>
          <Text color="green">{truncated}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Top border (row 0) */}
      <Box flexDirection="row">
        <Text>{isFocused && centerRow === 0 ? "> " : "  "}</Text>
        <Text color={color}>{"┌" + "─".repeat(10) + "┐"}</Text>
        <Text>{"    "}</Text>
        {rightLabel(0)}
      </Box>

      {/* Interior rows (row 1..height) */}
      {Array.from({ length: Math.max(1, height) }).map((_, i) => (
        <Box key={i} flexDirection="row">
          <Text>{isFocused && centerRow === i + 1 ? "> " : "  "}</Text>
          <Text color={color}>{"│"}</Text>
          <Text>{"          "}</Text>
          <Text color={color}>{"│"}</Text>
          <Text>{"    "}</Text>
          {rightLabel(i + 1)}
        </Box>
      ))}

      {/* Bottom border (row height+1) */}
      <Box flexDirection="row">
        <Text>{isFocused && centerRow === height + 1 ? "> " : "  "}</Text>
        <Text color={color}>{"└" + "─".repeat(10) + "┘"}</Text>
      </Box>
    </Box>
  );
}
