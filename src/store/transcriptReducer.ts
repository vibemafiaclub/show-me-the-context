import type {
  Block,
  ClaudeBlock,
  BaseBlock,
  ContextState,
  ContextAction,
  TranscriptLine,
} from "../core/types.js";
import {
  calculateTotalTokens,
  checkSummaryCriteria,
  extractFileChanges,
  getMaxContextTokens,
  DEFAULT_MAX_CONTEXT_TOKENS,
} from "../core/metrics.js";

const initialState: ContextState = {
  blocks: [],
  summaries: {},
  totalTokens: 0,
  modelId: null,
  maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
};

function parseTimestamp(ts: string | undefined): number {
  if (!ts) return Date.now();
  const parsed = Date.parse(ts);
  return isNaN(parsed) ? Date.now() : parsed;
}

function buildBlocks(lines: TranscriptLine[]): {
  blocks: Block[];
  totalTokens: number;
  modelId: string | null;
} {
  const blocks: Block[] = [];
  let blockIndex = 0;
  let totalTokens = 0;
  let currentClaude: ClaudeBlock | null = null;
  let detectedModelId: string | null = null;

  // Extract system prompt tokens from first line's cache_read_input_tokens
  const firstLine = lines[0];
  if (firstLine) {
    const cacheTokens =
      firstLine.message?.usage?.cache_read_input_tokens ?? 0;
    if (cacheTokens > 0) {
      const systemBlock: BaseBlock = {
        id: `block-${blockIndex++}`,
        type: "system",
        timestamp: parseTimestamp(firstLine.timestamp),
        tokens: cacheTokens,
        content: `System prompt (cached: ${cacheTokens} tokens)`,
      };
      blocks.push(systemBlock);
    }
  }

  function flushClaude() {
    if (currentClaude) {
      blocks.push(currentClaude);
      blockIndex++;
      currentClaude = null;
    }
  }

  for (const line of lines) {
    const lineTokens = calculateTotalTokens(line.message?.usage);
    if (lineTokens > totalTokens) {
      totalTokens = lineTokens;
    }

    const role = line.message?.role;
    const lineType = line.type;

    // User message
    if (lineType === "user" || (role === "user" && lineType !== "assistant")) {
      if (line.isMeta) continue;
      flushClaude();

      let content = "";
      const msgContent = line.message?.content;
      if (typeof msgContent === "string") {
        content = msgContent;
      } else if (Array.isArray(msgContent)) {
        content = msgContent
          .map((c) => {
            if (typeof c === "string") return c;
            if (
              typeof c === "object" &&
              c !== null &&
              "type" in c &&
              (c as Record<string, unknown>).type === "text"
            ) {
              return (c as Record<string, unknown>).text as string;
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
      }

      // Skip empty/noise user messages (no meaningful content)
      if (!content.trim()) continue;

      // User messages don't have usage data from the API.
      // Estimate tokens from content length (~4 chars per token).
      const estimatedUserTokens =
        lineTokens > 0 ? lineTokens : Math.max(1, Math.ceil(content.length / 4));

      const userBlock: BaseBlock = {
        id: `block-${blockIndex++}`,
        type: "user",
        timestamp: parseTimestamp(line.timestamp),
        tokens: estimatedUserTokens,
        content,
      };
      blocks.push(userBlock);
      continue;
    }

    // Assistant / progress lines
    if (
      lineType === "assistant" ||
      lineType === "progress" ||
      role === "assistant"
    ) {
      // 모델 ID 추출 (assistant 메시지의 message.model 필드)
      if (!detectedModelId && line.message) {
        const model = (line.message as Record<string, unknown>).model;
        if (typeof model === "string") {
          detectedModelId = model;
        }
      }
      const msgContent = line.message?.content;
      const contentBlocks: unknown[] = Array.isArray(msgContent)
        ? msgContent
        : [];

      // Extract tool calls
      const toolCallsInLine = contentBlocks.filter(
        (b) =>
          typeof b === "object" &&
          b !== null &&
          "type" in b &&
          (b as Record<string, unknown>).type === "tool_use",
      ).length;

      // Extract file changes
      const fileChanges = extractFileChanges(contentBlocks);

      // Extract thinking tokens
      let thinkingTokens = 0;
      for (const b of contentBlocks) {
        if (
          typeof b === "object" &&
          b !== null &&
          "type" in b &&
          (b as Record<string, unknown>).type === "thinking"
        ) {
          const thinkingBlock = b as Record<string, unknown>;
          const text =
            typeof thinkingBlock.thinking === "string"
              ? thinkingBlock.thinking
              : typeof thinkingBlock.text === "string"
                ? thinkingBlock.text
                : "";
          thinkingTokens += text.length;
        }
      }

      // Extract text content
      let content = "";
      for (const b of contentBlocks) {
        if (
          typeof b === "object" &&
          b !== null &&
          "type" in b &&
          (b as Record<string, unknown>).type === "text"
        ) {
          const textVal = (b as Record<string, unknown>).text;
          if (typeof textVal === "string") {
            content += (content ? "\n" : "") + textVal;
          }
        }
      }

      const stopReason = line.message?.stop_reason;
      const isCompleted = Boolean(stopReason && stopReason !== "tool_use");

      if (!currentClaude) {
        // Start a new ClaudeBlock
        currentClaude = {
          id: `block-${blockIndex}`,
          type: "claude",
          status: isCompleted ? "completed" : "running",
          timestamp: parseTimestamp(line.timestamp),
          tokens: lineTokens,
          content,
          toolCallCount: toolCallsInLine,
          thinkingTokens,
          fileChanges,
          requiresSummary: false,
          rawDetails: contentBlocks,
        };
      } else {
        // Accumulate into existing ClaudeBlock
        currentClaude.tokens = Math.max(currentClaude.tokens, lineTokens);
        currentClaude.toolCallCount += toolCallsInLine;
        currentClaude.thinkingTokens += thinkingTokens;
        currentClaude.fileChanges = [
          ...currentClaude.fileChanges,
          ...fileChanges,
        ];
        currentClaude.rawDetails = [
          ...currentClaude.rawDetails,
          ...contentBlocks,
        ];
        if (content) {
          currentClaude.content = currentClaude.content
            ? currentClaude.content + "\n" + content
            : content;
        }
        if (isCompleted) {
          currentClaude.status = "completed";
        }
      }

      // Set requiresSummary after accumulation
      currentClaude.requiresSummary = checkSummaryCriteria(
        currentClaude.toolCallCount,
        currentClaude.tokens,
      );

      // Flush if completed
      if (isCompleted) {
        flushClaude();
      }
      continue;
    }
  }

  // Flush any in-progress Claude block
  flushClaude();

  // Merge consecutive Claude blocks into one
  const merged: Block[] = [];
  for (const block of blocks) {
    const prev = merged[merged.length - 1];
    if (
      block.type === "claude" &&
      prev?.type === "claude"
    ) {
      const prevClaude = prev as ClaudeBlock;
      const curClaude = block as ClaudeBlock;
      const mergedBlock: ClaudeBlock = {
        ...prevClaude,
        tokens: Math.max(prevClaude.tokens, curClaude.tokens),
        content: prevClaude.content
          ? prevClaude.content + "\n" + curClaude.content
          : curClaude.content,
        toolCallCount: prevClaude.toolCallCount + curClaude.toolCallCount,
        thinkingTokens: prevClaude.thinkingTokens + curClaude.thinkingTokens,
        fileChanges: [...prevClaude.fileChanges, ...curClaude.fileChanges],
        rawDetails: [...prevClaude.rawDetails, ...curClaude.rawDetails],
        requiresSummary:
          prevClaude.requiresSummary || curClaude.requiresSummary,
        status: curClaude.status === "completed" ? "completed" : prevClaude.status,
      };
      merged[merged.length - 1] = mergedBlock;
    } else {
      merged.push(block);
    }
  }

  // Re-index block IDs after merge
  for (let i = 0; i < merged.length; i++) {
    merged[i] = { ...merged[i]!, id: `block-${i}` };
  }

  return { blocks: merged, totalTokens, modelId: detectedModelId };
}

export function transcriptReducer(
  state: ContextState = initialState,
  action: ContextAction,
): ContextState {
  switch (action.type) {
    case "SYNC_TRANSCRIPT": {
      const { blocks, totalTokens, modelId } = buildBlocks(action.payload);
      return {
        ...state,
        blocks,
        totalTokens,
        modelId: modelId ?? state.modelId,
        maxContextTokens: getMaxContextTokens(modelId ?? state.modelId),
      };
    }
    case "UPDATE_SUMMARY": {
      return {
        ...state,
        summaries: {
          ...state.summaries,
          [action.blockId]: action.summary,
        },
      };
    }
    default:
      return state;
  }
}
