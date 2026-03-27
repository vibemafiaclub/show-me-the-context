import { exec } from "node:child_process";
import type { EventEmitter } from "node:events";
import type { ClaudeBlock, ContextAction, StoreEvents } from "../core/types.js";

type StoreEmitter = EventEmitter & {
  on<K extends keyof StoreEvents>(event: K, listener: (payload: StoreEvents[K]) => void): StoreEmitter;
  off<K extends keyof StoreEvents>(event: K, listener: (payload: StoreEvents[K]) => void): StoreEmitter;
};

export class SummaryEffect {
  private store: StoreEmitter;
  private dispatch: (action: ContextAction) => void;
  private queue: ClaudeBlock[] = [];
  private running = false;
  private listener: ((block: ClaudeBlock) => void) | null = null;

  constructor(store: StoreEmitter, dispatch: (action: ContextAction) => void) {
    this.store = store;
    this.dispatch = dispatch;
  }

  start(): void {
    this.listener = (block: ClaudeBlock) => {
      if (block.requiresSummary) {
        this.enqueue(block);
      }
    };
    this.store.on("BLOCK_COMPLETED", this.listener);
  }

  stop(): void {
    if (this.listener) {
      this.store.off("BLOCK_COMPLETED", this.listener);
      this.listener = null;
    }
    this.queue = [];
  }

  private enqueue(block: ClaudeBlock): void {
    this.queue.push(block);
    if (!this.running) {
      this.processNext();
    }
  }

  private processNext(): void {
    const block = this.queue.shift();
    if (!block) {
      this.running = false;
      return;
    }

    this.running = true;
    const prompt = `다음 AI 응답을 1-2줄로 요약해줘: ${block.content}`;
    const cmd = `claude -p ${JSON.stringify(prompt)} --model haiku`;

    exec(cmd, (error, stdout) => {
      if (!error) {
        const summary = stdout.trim();
        if (summary) {
          this.dispatch({ type: "UPDATE_SUMMARY", blockId: block.id, summary });
        }
      }
      // Silently ignore errors - non-critical feature
      this.processNext();
    });
  }
}
