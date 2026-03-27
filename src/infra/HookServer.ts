import express from "express";
import type { Server } from "node:http";
import { EventEmitter } from "node:events";

const HOOK_PORT = 3456;

export interface HookEvent {
  event: string;
  session_id?: string;
  transcript_path?: string;
}

export interface HookServerEvents {
  SessionStart: HookEvent;
  Stop: HookEvent;
}

export class HookServer extends EventEmitter {
  private server: Server | null = null;
  private app = express();

  constructor() {
    super();
    this.app.use(express.json());

    this.app.post("/hook", (req, res) => {
      const body = req.body as HookEvent;
      if (body?.event) {
        this.emit(body.event, body);
      }
      res.status(200).json({ ok: true });
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(HOOK_PORT, () => {
          resolve();
        });
        this.server.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            // Port already in use - another instance may be running
            // Silently continue without the server
            this.server = null;
            resolve();
          } else {
            reject(err);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  // Typed event methods
  override on(event: "SessionStart", listener: (data: HookEvent) => void): this;
  override on(event: "Stop", listener: (data: HookEvent) => void): this;
  override on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  override off(event: "SessionStart", listener: (data: HookEvent) => void): this;
  override off(event: "Stop", listener: (data: HookEvent) => void): this;
  override off(event: string, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }
}

export { HOOK_PORT };
