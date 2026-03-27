# 6. CORE-LOGIC (핵심 데이터 구조 및 도메인 로직)

### 6.1. Types (데이터 모델)

```typescript
// 상태 정규화 (Normalized State)
export interface ContextState {
  blocks: Block[];
  summaries: Record<string, string>; // blockId -> summary text
  totalTokens: number;
}

// 블록 다형성
export type BlockType = "system" | "user" | "claude";

export interface BaseBlock {
  id: string;
  type: BlockType;
  timestamp: number;
  tokens: number;
}

export interface FileChange {
  path: string;
  added: number;
  removed: number;
}

export interface ClaudeBlock extends BaseBlock {
  type: "claude";
  status: "running" | "completed";
  content: string; // 단순 텍스트 원문 (요약 대상이 아닐 경우)
  toolCallCount: number;
  thinkingTokens: number;
  fileChanges: FileChange[];
  requiresSummary: boolean; // 요약 트리거 조건 충족 여부
  rawDetails: any[]; // 상세 화면용 JSON 데이터
}

export type Block = BaseBlock | ClaudeBlock; // System, User는 BaseBlock 형태
```

### 6.2. Reducer Core Logic (Pseudo-code)

트랜스크립트 파싱 및 그룹핑을 담당하는 핵심 도메인 로직입니다.

```typescript
function transcriptReducer(
  state: ContextState,
  action: ContextAction,
): ContextState {
  if (action.type !== "SYNC_TRANSCRIPT") return state; // UPDATE_SUMMARY 생략

  const newBlocks: Block[] = [];
  let currentClaudeBlock: Partial<ClaudeBlock> | null = null;
  let maxTokens = 0;

  for (const line of action.payload) {
    // [휴리스틱] System 블록 주입: 첫 턴의 cache_read_input_tokens 활용
    injectSystemBlockIfNeeded(newBlocks, line);

    // 1. User Message (새로운 턴 시작)
    if (line.type === "user" && !line.isMeta) {
      finalizeCurrentClaudeBlock(newBlocks, currentClaudeBlock);
      currentClaudeBlock = null;
      newBlocks.push(createUserBlock(line));
    }

    // 2. Claude (Assistant) 턴 그룹핑
    if (line.type === "assistant" || line.type === "progress") {
      if (!currentClaudeBlock)
        currentClaudeBlock = createInitialClaudeBlock(line);

      // 누적 로직: 토큰, 툴 사용, 라인 Diff 계산
      accumulateClaudeData(currentClaudeBlock, line);

      if (line.message?.usage) {
        maxTokens = Math.max(
          maxTokens,
          calculateTotalTokens(line.message.usage),
        );
      }

      // 턴 종료 조건: stop_reason이 존재하고 tool_use가 아닐 때
      if (
        line.message?.stop_reason &&
        line.message.stop_reason !== "tool_use"
      ) {
        currentClaudeBlock.status = "completed";
        // 요약 조건 판별 (툴 사용 유무 or 토큰 볼륨)
        currentClaudeBlock.requiresSummary =
          checkSummaryCriteria(currentClaudeBlock);
      }
    }
  }

  finalizeCurrentClaudeBlock(newBlocks, currentClaudeBlock);

  return { ...state, blocks: newBlocks, totalTokens: maxTokens };
}

// Post-processing: 연속된 Claude 블록을 하나로 머지
function mergeConsecutiveClaudeBlocks(blocks: Block[]): Block[] {
  const merged: Block[] = [];
  for (const block of blocks) {
    const prev = merged[merged.length - 1];
    if (block.type === "claude" && prev?.type === "claude") {
      // tokens: max, toolCallCount/thinkingTokens: 합산
      // fileChanges/rawDetails: 배열 연결, content: 줄바꿈 연결
      merged[merged.length - 1] = mergeClaudeBlock(prev, block);
    } else {
      merged.push(block);
    }
  }
  return merged; // 이후 block ID 재인덱싱
}
```

### 6.3. File Diff 추출 로직 (`metrics.ts`)

`Edit` 툴의 파라미터를 파싱하여 `+ / -` 라인을 구하는 코어 유틸리티입니다.

```typescript
export function extractLineChanges(
  oldString: string = "",
  newString: string = "",
): { added: number; removed: number } {
  const removed = oldString === "" ? 0 : oldString.split("\n").length;
  const added = newString === "" ? 0 : newString.split("\n").length;
  return { added, removed };
}
```
