import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import * as fs from 'node:fs';
import type { SessionInfo, ContextState } from '../core/types.js';
import { scanSessions } from '../core/sessions.js';
import { ContextStore } from '../store/store.js';
import { TranscriptWatcher } from '../infra/TranscriptWatcher.js';
import { SummaryEffect } from '../infra/SummaryEffect.js';
import { HookServer, HOOK_PORT } from '../infra/HookServer.js';
import { checkHooks, injectHooks } from '../infra/HookManager.js';
import SelectInput from 'ink-select-input';
import { SessionSelect } from './SessionSelect.js';
import { ContextVisScreen } from './ContextVisScreen.js';

type AppView = 'onboarding' | 'home' | 'loading' | 'select' | 'view';

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 24;

  // Check hooks on startup
  const hooksConfigured = checkHooks();
  const initialView: AppView = hooksConfigured ? 'home' : 'onboarding';

  const [view, setView] = useState<AppView>(initialView);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [contextState, setContextState] = useState<ContextState>({
    blocks: [],
    summaries: {},
    totalTokens: 0,
    modelId: null,
    maxContextTokens: 200_000,
  });
  const [store] = useState(() => new ContextStore());
  const [watcher, setWatcher] = useState<TranscriptWatcher | null>(null);
  const [summaryEffect, setSummaryEffect] = useState<SummaryEffect | null>(null);
  const [onboardingMsg, setOnboardingMsg] = useState('');
  const hookServerRef = useRef<HookServer | null>(null);
  const [hookServerRunning, setHookServerRunning] = useState(false);

  // Start hook server on mount
  useEffect(() => {
    const server = new HookServer();
    hookServerRef.current = server;

    server.start().then(() => {
      setHookServerRunning(server.isRunning());
    }).catch(() => {
      // server failed to start, continue without it
    });

    // Listen for new sessions via hook
    server.on('SessionStart', (data) => {
      if (data.transcript_path) {
        // Find or create the .jsonl path
        const transcriptPath = data.transcript_path;
        // Check if it's a valid .jsonl file path
        if (transcriptPath.endsWith('.jsonl') || fs.existsSync(transcriptPath)) {
          const session: SessionInfo = {
            id: `hook-${data.session_id ?? Date.now()}`,
            path: transcriptPath,
            date: new Date().toISOString().slice(0, 10),
            firstPrompt: '(live session)',
          };
          startSession(session);
        }
      }
    });

    return () => {
      server.stop();
      hookServerRef.current = null;
    };
  }, []);

  // Subscribe to store state changes
  useEffect(() => {
    const listener = (state: ContextState) => {
      setContextState(state);
    };
    store.on('STATE_CHANGED', listener);
    return () => {
      store.off('STATE_CHANGED', listener);
    };
  }, [store]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      watcher?.stop();
      summaryEffect?.stop();
    };
  }, [watcher, summaryEffect]);

  function startSession(session: SessionInfo) {
    watcher?.stop();
    summaryEffect?.stop();

    const newWatcher = new TranscriptWatcher(session.path, (action) => {
      store.dispatch(action);
    });
    const newEffect = new SummaryEffect(store, (action) => {
      store.dispatch(action);
    });

    newWatcher.start();
    newEffect.start();

    setWatcher(newWatcher);
    setSummaryEffect(newEffect);
    setView('view');
  }

  function handleLoadSessions() {
    setView('loading');
    const found = scanSessions();
    setSessions(found);
    setView('select');
  }

  function handleBackToHome() {
    watcher?.stop();
    summaryEffect?.stop();
    setWatcher(null);
    setSummaryEffect(null);
    setContextState({ blocks: [], summaries: {}, totalTokens: 0, modelId: null, maxContextTokens: 200_000 });
    setView('home');
  }

  function handleBackToHomeFromSelect() {
    setView('home');
  }

  function handleInjectHooks() {
    const result = injectHooks();
    if (result.success) {
      setOnboardingMsg(`Hook settings injected to ${result.path}`);
      setTimeout(() => setView('home'), 1000);
    } else {
      setOnboardingMsg(`Failed: ${result.error}`);
    }
  }

  // --- VIEWS ---

  if (view === 'onboarding') {
    return (
      <Box flexDirection="column" padding={1} minHeight={termHeight}>
        <Text bold color="cyan">Show me the Context</Text>
        <Box marginTop={1}>
          <Text color="yellow">Claude Code 이벤트 수신을 위한 Hook 설정이 누락되어 있습니다.</Text>
        </Box>
        <Text dimColor>설정 파일에 HTTP Hook을 자동으로 추가합니다 (기존 설정은 백업됩니다).</Text>
        {onboardingMsg ? (
          <Box marginTop={1}>
            <Text color={onboardingMsg.startsWith('Failed') ? 'red' : 'green'}>{onboardingMsg}</Text>
          </Box>
        ) : (
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: 'Hook 설정 자동 추가', value: 'inject' },
                { label: 'Skip (수동 설정)', value: 'skip' },
                { label: 'Quit', value: 'quit' },
              ]}
              onSelect={(item: { value: string }) => {
                if (item.value === 'inject') handleInjectHooks();
                else if (item.value === 'skip') setView('home');
                else exit();
              }}
            />
          </Box>
        )}
      </Box>
    );
  }

  if (view === 'home') {
    return (
      <Box flexDirection="column" padding={1} minHeight={termHeight}>
        <Text bold color="cyan">{'='
          .repeat(60)}</Text>
        <Text bold color="cyan">  Waiting for Claude Code...</Text>
        <Text bold color="cyan">{'='.repeat(60)}</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>  Claude Code 세션이 시작되기를 기다리고 있습니다.</Text>
          <Text>  다른 터미널 창에서 <Text bold>claude</Text> 명령어를 실행해 주세요.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            {hookServerRunning
              ? `  (Listening for hooks on http://localhost:${HOOK_PORT}/hook)`
              : '  (Hook server not running - port may be in use)'}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{'─'.repeat(60)}</Text>
        </Box>
        <Box marginTop={1}>
          <SelectInput
            items={[
              { label: '이전 세션 불러오기', value: 'load' },
              { label: '종료하기', value: 'quit' },
            ]}
            onSelect={(item: { value: string }) => {
              if (item.value === 'load') handleLoadSessions();
              else exit();
            }}
          />
        </Box>
      </Box>
    );
  }

  if (view === 'loading') {
    return (
      <Box padding={1} minHeight={termHeight}>
        <Text>Scanning ~/.claude/projects/ ...</Text>
      </Box>
    );
  }

  if (view === 'select') {
    return (
      <SessionSelect
        sessions={sessions}
        onSelect={startSession}
        onBack={handleBackToHomeFromSelect}
      />
    );
  }

  return (
    <ContextVisScreen
      state={contextState}
      onBack={handleBackToHome}
    />
  );
}
