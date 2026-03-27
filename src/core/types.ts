// 블록 다형성
export type BlockType = "system" | "user" | "claude";

export interface FileChange {
  path: string;
  added: number;
  removed: number;
}

export interface BaseBlock {
  id: string;
  type: BlockType;
  timestamp: number;
  tokens: number;
  content: string;
}

export interface ClaudeBlock extends BaseBlock {
  type: "claude";
  status: "running" | "completed";
  toolCallCount: number;
  thinkingTokens: number;
  fileChanges: FileChange[];
  requiresSummary: boolean;
  rawDetails: unknown[];
}

export type Block = BaseBlock | ClaudeBlock;

// 상태 정규화 (Normalized State)
export interface ContextState {
  blocks: Block[];
  summaries: Record<string, string>; // blockId -> summary text
  totalTokens: number;
  modelId: string | null; // 감지된 모델 ID (e.g. "claude-opus-4-6")
  maxContextTokens: number; // 모델별 최대 컨텍스트 토큰 수
}

// Actions
export type ContextAction =
  | { type: "SYNC_TRANSCRIPT"; payload: TranscriptLine[] }
  | { type: "UPDATE_SUMMARY"; blockId: string; summary: string };

// .jsonl 파일의 라인 타입
export interface TranscriptLine {
  type: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    stop_reason?: string;
  };
  // tool use related
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  // meta fields
  isMeta?: boolean;
  duration_ms?: number;
  num_turns?: number;
}

// Session info for session selector
export interface SessionInfo {
  id: string;
  path: string;
  date: string;
  firstPrompt: string;
}

// Store event types
export interface StoreEvents {
  BLOCK_COMPLETED: ClaudeBlock;
  STATE_CHANGED: ContextState;
}
