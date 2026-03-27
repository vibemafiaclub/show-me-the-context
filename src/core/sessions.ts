import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { SessionInfo } from "./types.js";

export function scanSessions(): SessionInfo[] {
  const projectsDir = path.join(os.homedir(), ".claude", "projects");
  const sessions: SessionInfo[] = [];

  let projectDirs: string[];
  try {
    projectDirs = fs.readdirSync(projectsDir);
  } catch {
    return sessions;
  }

  for (const projectDir of projectDirs) {
    const projectPath = path.join(projectsDir, projectDir);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(projectPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    let files: string[];
    try {
      files = fs.readdirSync(projectPath);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const filePath = path.join(projectPath, file);

      let mtime: Date;
      try {
        mtime = fs.statSync(filePath).mtime;
      } catch {
        continue;
      }
      const date = mtime.toISOString().slice(0, 10);

      let firstPrompt = "(no prompt)";
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const lines = raw.split("\n").filter((l) => l.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as {
              type?: string;
              message?: { role?: string; content?: unknown };
            };
            if (parsed.message?.role === "user") {
              const content = parsed.message.content;
              if (typeof content === "string") {
                firstPrompt = content.split("\n")[0]!.slice(0, 60);
              } else if (Array.isArray(content) && content.length > 0) {
                const first = content[0] as { type?: string; text?: string };
                if (first.text)
                  firstPrompt = first.text.split("\n")[0]!.slice(0, 60);
              }
              break;
            }
          } catch {
            // skip
          }
        }
      } catch {
        // skip
      }

      sessions.push({
        id: `${projectDir}/${file}`,
        path: filePath,
        date,
        firstPrompt,
      });
    }
  }

  sessions.sort((a, b) => b.date.localeCompare(a.date));
  return sessions;
}
