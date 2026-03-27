# CLAUDE.md

## Project

Show me the Context - Claude Code 세션의 컨텍스트 소모량, 사고 과정, 툴 사용을 실시간 시각화하는 TUI 도구.

## Build & Run

```bash
npm run build    # TypeScript 컴파일
npm run dev      # watch 모드
npm start        # 실행
```

## UI/UX Principles

- **전체 화면 전환**: 상세 보기, 설정 등 하위 뷰는 기존 화면 위에 오버레이하지 않고, 전체 화면을 교체하는 방식으로 전환한다. 사용자가 한 번에 하나의 뷰에만 집중할 수 있도록 한다. (예: 블록 상세보기는 블록 목록을 완전히 대체)
- **경량 표시**: 정보량이 적은 항목(User 메시지 등)은 박스/테두리 없이 한 줄로 간결하게 표시한다. 박스는 복잡한 정보(Claude 응답, System 프롬프트 등)에만 사용한다.
