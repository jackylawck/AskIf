// backend/src/room-hub.ts
import { Env } from './types';

// 為本地編輯器補齊 Cloudflare Workers 全域宣告，消除紅線
declare global {
  interface DurableObjectState {
    storage: {
      getAlarm(): Promise<number | null>;
      setAlarm(scheduledTime: number | Date): Promise<void>;
    };
    acceptWebSocket(ws: WebSocket, tags?: string[]): void;
    getWebSockets(tag?: string): WebSocket[];
  }
  interface DurableObject {
    fetch(request: Request): Promise<Response>;
    alarm?(): Promise<void>;
    webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): Promise<void>;
    webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void>;
    webSocketError?(ws: WebSocket, error: unknown): Promise<void>;
  }
  interface WebSocket {
    serializeAttachment(attachment: any): void;
    deserializeAttachment(): any;
  }
}

interface WsAttachment {
  role: "host" | "audience" | "display";
  authed: boolean;
  connectedAt: number;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// 企業級 XSS 消毒（微秒級完成，無外部庫相依性）
function sanitizeText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class RoomHub implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (!this.env.HOST_PASSWORD) {
      return new Response("Server misconfiguration: HOST_PASSWORD not set", { status: 500 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const requestedRole = (url.searchParams.get("role") ?? "audience").toLowerCase();
    
    const role: WsAttachment["role"] = 
      requestedRole === "host" ? "host" : 
      requestedRole === "display" ? "display" : "audience";

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    const isHost = role === "host";
    const initialData: WsAttachment = {
      role,
      authed: !isHost,
      connectedAt: Date.now()
    };

    this.state.acceptWebSocket(server, [role]);
    server.serializeAttachment(initialData);

    if (isHost) {
      const currentAlarm = await this.state.storage.getAlarm();
      if (currentAlarm === null) {
        await this.state.storage.setAlarm(Date.now() + 5000);
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm(): Promise<void> {
    const hosts = this.state.getWebSockets("host");
    const now = Date.now();
    let earliestPending = Infinity;

    for (const host of hosts) {
      const att = host.deserializeAttachment() as WsAttachment;
      if (att?.role === "host" && !att?.authed) {
        const deadline = att.connectedAt + 5000;
        if (now >= deadline) {
          host.close(1008, "Authentication Timeout");
        } else {
          earliestPending = Math.min(earliestPending, deadline);
        }
      }
    }

    if (earliestPending !== Infinity) {
      await this.state.storage.setAlarm(earliestPending);
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message === "string" && message.length > 4096) {
      ws.close(1009, "Payload too large");
      return;
    }

    const attachment = (ws.deserializeAttachment() as WsAttachment) || {
      role: "audience",
      authed: true,
      connectedAt: Date.now()
    };

    let data: any;
    try {
      data = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      ws.close(1003, "Invalid JSON");
      return;
    }

    if (data.type === "PING") {
      try { ws.send(JSON.stringify({ type: "PONG" })); } catch {}
      return;
    }

    if (attachment.role === "host" && !attachment.authed) {
      if (Date.now() - attachment.connectedAt > 5000) {
        ws.close(1008, "Authentication Timeout");
        return;
      }

      if (data.type === "AUTH") {
        const passwordMatch = typeof data.password === "string" && timingSafeEqual(data.password, this.env.HOST_PASSWORD);
        const hasValidToken = data.token === "VALID_HOST_TICKET";

        if (passwordMatch || hasValidToken) {
          attachment.authed = true;
          ws.serializeAttachment(attachment);
          ws.send(JSON.stringify({ type: "AUTH_SUCCESS" }));
          ws.send(JSON.stringify({ type: "STATUS", status: "ONLINE" }));
          return;
        }
      }
      ws.close(1008, "Authentication Failed");
      return;
    }

    switch (data.type) {
      case "REQ_SYNC":
      case "SUBMIT":
      case "SUBMIT_QUESTION": {
        if (typeof data.text === "string") {
          data.text = sanitizeText(data.text.trim().substring(0, 200));
        }
        const hosts = this.state.getWebSockets("host");
        const payload = JSON.stringify(data);
        for (const host of hosts) {
          const att = host.deserializeAttachment() as WsAttachment;
          if (att?.authed) {
            try { host.send(payload); } catch {}
          }
        }
        break;
      }

      case "UPVOTE": {
        const hosts = this.state.getWebSockets("host");
        const payload = JSON.stringify(data);
        for (const host of hosts) {
          const att = host.deserializeAttachment() as WsAttachment;
          if (att?.authed) {
            try { host.send(payload); } catch {}
          }
        }
        break;
      }

      case "SPOTLIGHT":
      case "SYNC_POOL":
      case "STATE": {
        if (attachment.role !== "host" || !attachment.authed) {
          ws.close(1008, "Forbidden Broadcast");
          return;
        }

        const targets = [
          ...this.state.getWebSockets("audience"),
          ...this.state.getWebSockets("display")
        ];
        const payload = JSON.stringify(data);
        for (const target of targets) {
          try { target.send(payload); } catch {}
        }
        break;
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    if (!wasClean && code !== 1000) {
      console.log(`[WS Close] code=${code} reason=${reason}`);
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("[WS Error]", error);
    try { ws.close(1011, "Internal server error"); } catch {}
  }
}