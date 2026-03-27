import * as fs from "node:fs";
import * as path from "node:path";
import type { ContextAction, TranscriptLine } from "../core/types.js";

export class TranscriptWatcher {
  private filePath: string;
  private dispatch: (action: ContextAction) => void;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private watcher: fs.FSWatcher | null = null;
  private lastSize = 0;

  constructor(filePath: string, dispatch: (action: ContextAction) => void) {
    this.filePath = path.resolve(filePath);
    this.dispatch = dispatch;
  }

  start(): void {
    // Initial read
    this.readAndDispatch();

    // Use fs.watch for change detection, fall back to polling
    try {
      this.watcher = fs.watch(this.filePath, () => {
        this.readAndDispatch();
      });
      this.watcher.on("error", () => {
        this.watcher?.close();
        this.watcher = null;
        this.startPolling();
      });
    } catch {
      this.startPolling();
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private startPolling(): void {
    this.intervalId = setInterval(() => {
      this.readAndDispatch();
    }, 1000);
  }

  private readAndDispatch(): void {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(this.filePath);
    } catch {
      return;
    }

    // Skip if file size unchanged (no new content)
    if (stat.size === this.lastSize) return;
    this.lastSize = stat.size;

    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, "utf8");
    } catch {
      return;
    }

    const lines: TranscriptLine[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        lines.push(JSON.parse(trimmed) as TranscriptLine);
      } catch {
        // Skip invalid JSON lines
      }
    }

    this.dispatch({ type: "SYNC_TRANSCRIPT", payload: lines });
  }
}
