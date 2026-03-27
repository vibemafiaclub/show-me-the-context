# 4. ADR (Architecture Decision Records)

**ADR 1: 상태 전이 모델 - Pure Reducer 채택**

- **결정:** 트랜스크립트 파싱 및 블록 생성 로직을 순수 함수형 Reducer로 구현한다.
- **사유:** 동일한 `.jsonl` 라인 배열이 주어지면 항상 동일한 `Block[]` 배열을 반환해야 완벽한 Happy Path 단위 테스트가 가능하기 때문.

**ADR 2: 외부 통신(Side Effect) 격리 - Middleware/Event Bus**

- **결정:** Reducer 내부에서 Haiku 요약 API를 직접 호출하지 않고, Store의 이벤트 발행을 통해 별도의 `SummaryEffect` 모듈이 처리하도록 분리한다.
- **사유:** 도메인 로직과 I/O 작업을 분리하여 단일 책임 원칙(SRP)을 준수하고, 테스트 시 요약 기능을 쉽게 Mocking하기 위함.

**ADR 3: 파일 읽기 전략 - Snapshot Polling**

- **결정:** `fs.watch` 이벤트 발생 시 추가된 라인만 읽는 것(Tailing)이 아니라, `.jsonl` 파일 전체를 다시 읽어 Reducer에 통과시킨다.
- **사유:** 성능 손해는 미미하나(수 MB 이하), 상태 꼬임이나 이벤트 유실에 대한 방어력이 극대화되어 아키텍처가 단순해지고 견고해짐.

**ADR 4: TUI 스크롤링 및 높이 제한 - Windowing 제어**

- **결정:** `ink`의 기본 스크롤링에 의존하지 않고, 터미널 높이를 계산(`useStdoutDimensions`)하여 `focusedIndex` 주변의 블록만 슬라이싱하여 렌더링한다.
- **사유:** 터미널 기본 스크롤을 방치하면 키보드 네비게이션 시 포커스된 요소가 화면 밖으로 사라지는 UX 마찰이 발생하기 때문.

**ADR 5: 연속 Assistant 블록 머지 - Post-Processing Pass**

- **결정:** Reducer의 `buildBlocks` 이후 후처리 단계에서 연속된 `claude` 타입 블록을 하나로 통합한다.
- **사유:** Claude Code는 tool_use 중간에 stop_reason을 발생시켜 하나의 논리적 턴이 여러 블록으로 분리될 수 있음. 사용자 관점에서는 하나의 응답으로 인식되므로 머지가 직관적.

**ADR 6: 블록 높이 계산 - 비례형(Proportional) 채택**

- **결정:** 블록 높이를 절대값(tokens / 2000)이 아닌, 윈도우 내 전체 토큰 대비 비율로 계산한다.
- **사유:** 대규모 System 프롬프트(100k+ 토큰)가 화면을 독점하여 다른 블록을 밀어내는 문제 방지. 상대적 비율로 모든 블록이 적절한 크기로 공존.

**ADR 7: Hook 기반 세션 자동 감지 - Express HTTP Server**

- **결정:** Claude Code의 Lifecycle Hook을 Express 서버(포트 3456)로 수신하여, 새 세션 시작 시 `transcript_path`를 자동 감지하고 메인 뷰로 전환한다.
- **사유:** 사용자가 수동으로 세션 파일을 선택하지 않아도 되므로 UX 마찰이 최소화되고, 실시간 모니터링 시나리오에 적합.
