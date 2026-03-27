# 1. PRD (Product Requirements Document)

**프로젝트명:** `claude-context-vis` (Claude Code Context Visualizer)
**목적:** Vibe coding 환경에서 Claude Code 에이전트의 컨텍스트 소모량, 사고 과정, 툴 사용 내역을 시각화하여 내부 동작 원리를 투명하게 보여주는 교육용/모니터링 POC 도구.

**Target Audience:**

- DEUS 프로젝트 교육 콘텐츠 시청자 (에이전트 동작 원리 학습)
- Vibe coding을 수행하는 개발자 (컨텍스트 최적화 및 디버깅)

**핵심 기능 (Key Features):**

1. **실시간 컨텍스트 점유율 모니터링:** 200k 토큰 제한 대비 현재 세션의 소모량을 상단 상태바로 표시.
2. **비례형 컨텍스트 블록 시각화:** 대화 턴(System/User/Claude)별 소모 토큰에 비례하여 ASCII 블록의 높이를 동적으로 렌더링.
3. **스마트 요약 (Smart Summarization):** 단순 응답은 원문을, 복잡한 Tool Call(Edit, Bash 등)이 포함된 턴은 백그라운드에서 Haiku 모델을 활용해 1~2줄로 자동 요약.
4. **상태 변이(Mutation) 하이라이트:** 에이전트가 수정한 파일의 경로와 라인 변화량(`+추가 -삭제`)을 직관적으로 추출하여 표시.
5. **사고 과정(Thinking) 추적:** 추론에 소모된 토큰량을 명시하여 AI의 에이전틱(Agentic) 특성 강조.

6. **자동 훅(Hook) 구성 및 검사:** CLI 도구가 Claude Code의 이벤트를 수신할 수 있도록, 사용자 환경의 `settings.json`을 검사하고 필요한 HTTP Hook 설정을 원클릭으로 주입하는 온보딩 기능.
7. **대기 상태(Idle) 및 히스토리 탐색:** 현재 활성화된 세션이 없을 때 직관적인 대기 화면을 노출하고, 과거의 Vibe coding 세션(`.jsonl` 파일 목록)을 불러와 조회할 수 있는 진입점 제공.
8. **연속 Assistant 블록 머지:** 동일 턴에서 tool_use로 인해 분리된 연속 Claude 블록을 하나로 통합하여 표시.
9. **비례형 블록 높이:** 터미널 가용 높이 대비 각 블록의 토큰 비율(%)로 높이를 동적 계산. 절대값(tokens/2000) 대신 상대적 비율 사용.
10. **텍스트 단일 라인 표시:** 블록 우측 및 세션 목록에서 콘텐츠 첫 줄바꿈 이전 내용만 표시하여 가독성 확보.

**Non-Goals (이 프로젝트에서 하지 않는 것):**

- CLI 내에서 직접 Claude에게 프롬프트를 전송하거나 세션 데이터를 수정하는 기능 (Read-Only 모니터링 툴 지향).
