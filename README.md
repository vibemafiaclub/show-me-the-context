# Show me the Context

Claude Code를 사용할 때 **컨텍스트 윈도우가 얼마나 차고 있는지** 실시간으로 보여주는 터미널 도구입니다.

```
[ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ] Context: 198,234 / 1,000,000 (19.8%)
============================================================
  ┌──────────┐    System (45,231 tokens)
  │          │
  │          │
  └──────────┘
  ● User: 이 함수를 리팩토링해줘 (342 tokens)
> ┌──────────┐    Claude (152,661 tokens)
  │          │    src/auth/login.ts +12 -8 | src/auth/types.ts +3 -1
  │          │    Tools: 5 | Thinking: 2,340 tokens
  │          │
  │          │
  └──────────┘
[FOLLOW] ↑↓ navigate  ESC re-enable follow  Enter toggle detail  q back [3/3]
```

## 왜 필요한가요?

Claude Code는 대화가 길어지면 컨텍스트 윈도우가 가득 차서 이전 대화를 요약(compaction)합니다. 이 과정에서 중요한 맥락이 손실될 수 있습니다.

**Show me the Context**를 옆 터미널에 띄워두면:

- 지금 컨텍스트의 몇 %를 사용 중인지 한눈에 파악
- 어떤 블록(System/User/Claude)이 토큰을 많이 차지하는지 시각적으로 확인
- Claude가 몇 개의 툴을 호출했고, 어떤 파일을 수정했는지 추적
- 모델별 최대 컨텍스트 크기 자동 감지 (Opus 4.6: 1M, Sonnet: 200K 등)

## 설치 및 실행

```bash
npm install -g show-me-the-context
```

```bash
show-me-the-context
```

첫 실행 시 Claude Code 연동을 위한 Hook 설정을 안내합니다. **"Hook 설정 자동 추가"** 를 선택하면 자동으로 완료됩니다.

이후 다른 터미널에서 `claude`를 실행하면 자동으로 감지하여 실시간 시각화가 시작됩니다.

## 조작법

| 키 | 동작 |
|----|------|
| `↑` `↓` | 블록 탐색 |
| `Enter` | 선택한 블록의 상세 정보 보기 |
| `ESC` | 팔로우 모드 복귀 / 상세 보기 닫기 |
| `q` | 뒤로 가기 |

## 라이선스

MIT
