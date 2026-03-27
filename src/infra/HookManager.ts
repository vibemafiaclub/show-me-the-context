import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const HOOK_SERVER_URL = "http://localhost:3456/hook";

const REQUIRED_HOOKS = {
  hooks: {
    SessionStart: [
      {
        matcher: "",
        hooks: [
          {
            type: "command" as const,
            command: `curl -s -X POST ${HOOK_SERVER_URL} -H "Content-Type: application/json" -d "{\\"event\\":\\"SessionStart\\",\\"session_id\\":\\"$SESSION_ID\\",\\"transcript_path\\":\\"$TRANSCRIPT_PATH\\"}"`,
          },
        ],
      },
    ],
    Stop: [
      {
        matcher: "",
        hooks: [
          {
            type: "command" as const,
            command: `curl -s -X POST ${HOOK_SERVER_URL} -H "Content-Type: application/json" -d "{\\"event\\":\\"Stop\\",\\"session_id\\":\\"$SESSION_ID\\"}"`,
          },
        ],
      },
    ],
  },
};

interface SettingsJson {
  hooks?: Record<string, unknown[]>;
  [key: string]: unknown;
}

function getSettingsPaths(): string[] {
  return [
    path.join(os.homedir(), ".claude", "settings.json"),
    path.join(process.cwd(), ".claude", "settings.json"),
  ];
}

function readSettings(filePath: string): SettingsJson | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as SettingsJson;
  } catch {
    return null;
  }
}

function hasHooksConfigured(settings: SettingsJson): boolean {
  if (!settings.hooks) return false;
  const hooks = settings.hooks;

  const hasSessionStart = Array.isArray(hooks["SessionStart"]) &&
    (hooks["SessionStart"] as Array<Record<string, unknown>>).some(
      (entry) => {
        if (typeof entry !== "object" || entry === null) return false;
        const innerHooks = (entry as Record<string, unknown>).hooks;
        if (!Array.isArray(innerHooks)) return false;
        return (innerHooks as Array<Record<string, unknown>>).some(
          (h) => typeof h === "object" && h !== null &&
            String(h.command ?? "").includes("localhost:3456"),
        );
      },
    );

  return Boolean(hasSessionStart);
}

/**
 * Check if hook settings are configured in any settings.json
 * Returns the path where hooks are configured, or null if not found
 */
export function checkHooks(): string | null {
  for (const settingsPath of getSettingsPaths()) {
    const settings = readSettings(settingsPath);
    if (settings && hasHooksConfigured(settings)) {
      return settingsPath;
    }
  }
  return null;
}

/**
 * Inject hook settings into the global settings.json
 * Backs up existing file before modifying
 */
export function injectHooks(): { success: boolean; path: string; error?: string } {
  const globalSettingsPath = path.join(os.homedir(), ".claude", "settings.json");
  const dirPath = path.dirname(globalSettingsPath);

  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Read existing or create empty
  let settings: SettingsJson;
  if (fs.existsSync(globalSettingsPath)) {
    // Backup
    const backupPath = `${globalSettingsPath}.backup.${new Date().toISOString().slice(0, 10)}`;
    try {
      fs.copyFileSync(globalSettingsPath, backupPath);
    } catch {
      // best effort backup
    }
    settings = readSettings(globalSettingsPath) ?? {};
  } else {
    settings = {};
  }

  // Merge hooks
  if (!settings.hooks) {
    settings.hooks = {};
  }

  const existingHooks = settings.hooks as Record<string, unknown[]>;

  for (const [eventName, hookEntries] of Object.entries(REQUIRED_HOOKS.hooks)) {
    if (!existingHooks[eventName]) {
      existingHooks[eventName] = [];
    }
    const existing = existingHooks[eventName] as Array<Record<string, unknown>>;
    // Only add if not already present
    for (const hookEntry of hookEntries) {
      const alreadyExists = existing.some((entry) => {
        const innerHooks = (entry as Record<string, unknown>).hooks;
        if (!Array.isArray(innerHooks)) return false;
        return (innerHooks as Array<Record<string, unknown>>).some(
          (h) => String(h.command ?? "").includes("localhost:3456"),
        );
      });
      if (!alreadyExists) {
        existing.push(hookEntry);
      }
    }
  }

  try {
    fs.writeFileSync(globalSettingsPath, JSON.stringify(settings, null, 2), "utf8");
    return { success: true, path: globalSettingsPath };
  } catch (e) {
    return {
      success: false,
      path: globalSettingsPath,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
