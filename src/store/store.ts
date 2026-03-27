import { EventEmitter } from "events";
import type {
  ContextState,
  ContextAction,
  ClaudeBlock,
  StoreEvents,
} from "../core/types.js";
import { transcriptReducer } from "./transcriptReducer.js";

const initialState: ContextState = {
  blocks: [],
  summaries: {},
  totalTokens: 0,
  modelId: null,
  maxContextTokens: 200_000,
};

export class ContextStore extends EventEmitter {
  private state: ContextState;

  constructor(initialOverride?: ContextState) {
    super();
    this.state = initialOverride ?? initialState;
  }

  getState(): ContextState {
    return this.state;
  }

  dispatch(action: ContextAction): void {
    const prevState = this.state;
    this.state = transcriptReducer(this.state, action);

    // Detect newly completed ClaudeBlocks
    const prevBlockMap = new Map<string, ClaudeBlock>();
    for (const block of prevState.blocks) {
      if (block.type === "claude") {
        prevBlockMap.set(block.id, block as ClaudeBlock);
      }
    }

    for (const block of this.state.blocks) {
      if (block.type === "claude") {
        const claudeBlock = block as ClaudeBlock;
        const prev = prevBlockMap.get(claudeBlock.id);
        const wasRunning = !prev || prev.status === "running";
        const isNowCompleted = claudeBlock.status === "completed";
        if (wasRunning && isNowCompleted) {
          this.emit("BLOCK_COMPLETED", claudeBlock);
        }
      }
    }

    this.emit("STATE_CHANGED", this.state);
  }

  // Typed overloads for EventEmitter
  on<K extends keyof StoreEvents>(
    event: K,
    listener: (data: StoreEvents[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof StoreEvents>(
    event: K,
    listener: (data: StoreEvents[K]) => void,
  ): this {
    return super.off(event, listener);
  }

  once<K extends keyof StoreEvents>(
    event: K,
    listener: (data: StoreEvents[K]) => void,
  ): this {
    return super.once(event, listener);
  }

  emit<K extends keyof StoreEvents>(event: K, data: StoreEvents[K]): boolean {
    return super.emit(event, data);
  }
}

// Singleton factory
let _instance: ContextStore | null = null;

export function getStore(): ContextStore {
  if (!_instance) {
    _instance = new ContextStore();
  }
  return _instance;
}

export function createStore(initialState?: ContextState): ContextStore {
  return new ContextStore(initialState);
}
