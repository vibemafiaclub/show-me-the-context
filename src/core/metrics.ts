import type { FileChange, TranscriptLine } from "./types.js";

const DEFAULT_MAX_CONTEXT_TOKENS = 200_000;
const TOKENS_PER_LINE = 2_000;

/**
 * 모델 ID → 최대 컨텍스트 토큰 매핑
 * prefix 매칭으로 동작 (e.g. "claude-opus-4-6" 매칭)
 */
const MODEL_CONTEXT_MAP: Array<{ prefix: string; maxTokens: number }> = [
  { prefix: "claude-opus-4-6", maxTokens: 1_000_000 },
  { prefix: "claude-sonnet-4-6", maxTokens: 200_000 },
  { prefix: "claude-haiku-4-5", maxTokens: 200_000 },
];

/**
 * 모델 ID로부터 최대 컨텍스트 토큰 수 결정
 */
export function getMaxContextTokens(modelId: string | null): number {
  if (!modelId) return DEFAULT_MAX_CONTEXT_TOKENS;
  for (const { prefix, maxTokens } of MODEL_CONTEXT_MAP) {
    if (modelId.startsWith(prefix)) return maxTokens;
  }
  return DEFAULT_MAX_CONTEXT_TOKENS;
}

/**
 * Edit 툴의 old_string/new_string으로부터 라인 변화량 추출
 */
export function extractLineChanges(
  oldString: string = "",
  newString: string = "",
): { added: number; removed: number } {
  const removed = oldString === "" ? 0 : oldString.split("\n").length;
  const added = newString === "" ? 0 : newString.split("\n").length;
  return { added, removed };
}

/**
 * usage 객체에서 총 토큰 수 계산
 */
export function calculateTotalTokens(
  usage: NonNullable<TranscriptLine["message"]>["usage"],
): number {
  if (!usage) return 0;
  return (
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0)
  );
}

/**
 * 요약이 필요한지 판별 (툴 호출 2개 이상 or 토큰 5000 이상)
 */
export function checkSummaryCriteria(
  toolCallCount: number,
  tokens: number,
): boolean {
  return toolCallCount >= 2 || tokens >= 5000;
}

/**
 * 토큰 수를 블록 높이(라인 수)로 변환. 최소 1줄.
 */
export function tokensToHeight(tokens: number): number {
  return Math.max(1, Math.round(tokens / TOKENS_PER_LINE));
}

/**
 * 컨텍스트 점유율 퍼센트 계산
 */
export function contextPercentage(totalTokens: number, maxTokens: number = DEFAULT_MAX_CONTEXT_TOKENS): number {
  return (totalTokens / maxTokens) * 100;
}

/**
 * 프로그레스 바 렌더링용 문자열 생성
 */
export function renderProgressBar(
  totalTokens: number,
  maxTokens: number = DEFAULT_MAX_CONTEXT_TOKENS,
  barWidth: number = 40,
): string {
  const pct = totalTokens / maxTokens;
  const filled = Math.round(pct * barWidth);
  const empty = barWidth - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const label = `${totalTokens.toLocaleString()} / ${maxTokens.toLocaleString()} (${(pct * 100).toFixed(1)}%)`;
  return `[ ${bar} ] Context: ${label}`;
}

/**
 * tool_use content에서 파일 변경사항 추출
 */
export function extractFileChanges(
  contentBlocks: unknown[],
): FileChange[] {
  const changes: FileChange[] = [];

  for (const block of contentBlocks) {
    if (
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      (block as Record<string, unknown>).type === "tool_use"
    ) {
      const toolBlock = block as Record<string, unknown>;
      const name = toolBlock.name as string | undefined;
      const input = toolBlock.input as Record<string, unknown> | undefined;

      if (name === "Edit" && input) {
        const filePath = (input.file_path as string) ?? "unknown";
        const { added, removed } = extractLineChanges(
          input.old_string as string | undefined,
          input.new_string as string | undefined,
        );
        changes.push({ path: filePath, added, removed });
      } else if (name === "Write" && input) {
        const filePath = (input.file_path as string) ?? "unknown";
        const content = (input.content as string) ?? "";
        changes.push({
          path: filePath,
          added: content.split("\n").length,
          removed: 0,
        });
      }
    }
  }

  return changes;
}

export { DEFAULT_MAX_CONTEXT_TOKENS, TOKENS_PER_LINE };
