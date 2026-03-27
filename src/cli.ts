import * as fs from "node:fs";
import type { TranscriptLine } from "./core/types.js";
import { scanSessions } from "./core/sessions.js";
import { buildBlocks } from "./store/transcriptReducer.js";
import { getMaxContextTokens } from "./core/metrics.js";

export function listSessions(json: boolean): void {
  const sessions = scanSessions();

  if (json) {
    console.log(JSON.stringify(sessions, null, 2));
    return;
  }

  if (sessions.length === 0) {
    console.log("No sessions found in ~/.claude/projects/");
    return;
  }

  console.log(`Found ${sessions.length} session(s):\n`);
  for (const s of sessions) {
    console.log(`  ${s.id}`);
    console.log(`    Date: ${s.date}  Prompt: ${s.firstPrompt}`);
  }
}

export function viewSession(sessionId: string, json: boolean): void {
  const sessions = scanSessions();
  const session = sessions.find((s) => s.id === sessionId);

  if (!session) {
    if (json) {
      console.log(JSON.stringify({ error: "Session not found", sessionId }));
    } else {
      console.error(`Session not found: ${sessionId}`);
      console.error("Use 'show-me-the-context sessions' to list available sessions.");
    }
    process.exit(1);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(session.path, "utf8");
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ error: "Failed to read transcript", sessionId }));
    } else {
      console.error(`Failed to read transcript: ${session.path}`);
    }
    process.exit(1);
  }

  const lines: TranscriptLine[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      lines.push(JSON.parse(trimmed) as TranscriptLine);
    } catch {
      // skip invalid JSON
    }
  }

  const { blocks, totalTokens, modelId } = buildBlocks(lines);
  const maxContextTokens = getMaxContextTokens(modelId);

  const result = {
    sessionId: session.id,
    path: session.path,
    date: session.date,
    modelId,
    totalTokens,
    maxContextTokens,
    blockCount: blocks.length,
    blocks: blocks.map((b) => {
      const base = {
        id: b.id,
        type: b.type,
        tokens: b.tokens,
        contentPreview: b.content.split("\n")[0]?.slice(0, 100) ?? "",
      };
      if (b.type === "claude") {
        const cb = b as typeof b & {
          toolCallCount: number;
          thinkingTokens: number;
          fileChanges: Array<{ path: string; added: number; removed: number }>;
          status: string;
        };
        return {
          ...base,
          status: cb.status,
          toolCallCount: cb.toolCallCount,
          thinkingTokens: cb.thinkingTokens,
          fileChanges: cb.fileChanges,
        };
      }
      return base;
    }),
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Human-readable output
  console.log(`Session: ${result.sessionId}`);
  console.log(`Date: ${result.date}  Model: ${result.modelId ?? "unknown"}`);
  console.log(`Tokens: ${result.totalTokens.toLocaleString()} / ${result.maxContextTokens.toLocaleString()}`);
  console.log(`Blocks: ${result.blockCount}\n`);

  for (const block of result.blocks) {
    const tokenStr = block.tokens.toLocaleString();
    if (block.type === "claude" && "toolCallCount" in block) {
      const cb = block as typeof block & {
        toolCallCount: number;
        thinkingTokens: number;
        status: string;
      };
      console.log(`  [${block.id}] Claude (${tokenStr} tokens) tools=${cb.toolCallCount} thinking=${cb.thinkingTokens}`);
    } else {
      const label = block.type.charAt(0).toUpperCase() + block.type.slice(1);
      console.log(`  [${block.id}] ${label} (${tokenStr} tokens)`);
    }
    if (block.contentPreview) {
      console.log(`    ${block.contentPreview}`);
    }
  }
}

export function printUsage(): void {
  console.log(`Usage: show-me-the-context [command] [options]

Commands:
  (none)                     Launch interactive TUI
  sessions [--json]          List available sessions
  view <session-id> [--json] View a specific session

Options:
  --json                     Output as JSON instead of human-readable text
  --help                     Show this help message

Examples:
  show-me-the-context sessions
  show-me-the-context sessions --json
  show-me-the-context view "projectDir/session.jsonl"
  show-me-the-context view "projectDir/session.jsonl" --json`);
}
