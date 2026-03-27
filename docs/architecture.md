# 2. ARCHITECTURE (시스템 아키텍처)

단일 책임 원칙(SRP)과 테스트 용이성을 극대화하기 위해 3계층(Layered) + 단방향 데이터 플로우(Unidirectional Data Flow)를 채택합니다.

**Tech Stack:** `Node.js`, `ink` (React for CLI), `express` (Hook Server), `child_process` (Haiku).

**1. Presentation Layer (`/ui`)**

- **역할:** 터미널 UI 렌더링 및 키보드 입력(이벤트) 감지.
- **주요 모듈:** `App.tsx` (라우팅), `ContextVisScreen.tsx` (메인 뷰), `BlockItem.tsx` (비례형 블록 렌더링).

**2. Domain / Business Layer (`/store`, `/core`)**

- **역할:** 상태 관리, 비즈니스 규칙(토큰 계산, 블록 그룹핑) 적용.
- **주요 모듈:** \* `store.ts`: 중앙 상태 관리소 (ContextStore).
  - `transcriptReducer.ts`: 순수 함수 기반의 상태 전이 로직.
  - `metrics.ts`: 토큰 비례식 및 파일 라인 Diff(`+ / -`) 계산 유틸리티.

**3. Infrastructure / Data Layer (`/infra`)**

- **역할:** 외부 시스템(파일, 네트워크, 프로세스)과의 통신 및 부수 효과(Side Effect) 처리.
- **주요 모듈:**
  - `HookManager.ts`: 글로벌(`~/.claude/settings.json`) 또는 로컬(`.claude/settings.json`)의 설정 파일을 파싱하여, 로컬 서버(`http://localhost:3456/hook`)를 향하는 `SessionStart`, `Stop` 훅이 등록되어 있는지 확인하고, 없다면 사용자 동의를 얻어 JSON을 안전하게 업데이트(Inject).
  - `HookServer.ts`: Express 기반 HTTP 서버(포트 3456). Claude Code의 Lifecycle 이벤트(`SessionStart` 등) 수신 및 `transcript_path` 추출.
  - `TranscriptWatcher.ts`: `.jsonl` 파일 스냅샷 폴링.
  - `SummaryEffect.ts`: 이벤트 버스를 구독하여 백그라운드 Haiku 프로세스(`claude -p`) 실행 및 결과 디스패치.
