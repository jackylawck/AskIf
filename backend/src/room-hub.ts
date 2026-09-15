// backend/src/room-hub.ts
export interface Env {
  HOST_PASSWORD?: string; // 必須由 wrangler secret 提供
}

interface WsAttachment {
  role: "host" | "audience" | "display";
  authed: boolean;
  connectedAt: number;
}

// 時序安全字串比對 (Constant-time comparison)
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export class RoomHub implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    // 1. 安全紀律：缺少密鑰配置立即拒絕服務（防裸奔）
    if (!this.env.HOST_PASSWORD) {
      console.error("[CRITICAL] HOST_PASSWORD secret is not set.");
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

    // 握手標籤固定，不進行二次標記
    this.state.acceptWebSocket(server, [role]);
    server.serializeAttachment(initialData);

    // 2. 主動超時防禦：若有主持人連線進入，排程 5 秒後的 Alarm
    if (isHost) {
      const currentAlarm = await this.state.storage.getAlarm();
      if (currentAlarm === null) {
        await this.state.storage.setAlarm(Date.now() + 5000);
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  // 3. DO 原生鬧鐘：精確排程主動清理逾時連線（防慢速 DoS）
  async alarm(): Promise<void> {
    const hosts = this.state.getWebSockets("host");
    const now = Date.now();
    let earliestPending = Infinity;

    for (const host of hosts) {
      const att = host.deserializeAttachment() as WsAttachment;
      if (att?.role === "host" && !att?.authed) {
        const deadline = att.connectedAt + 5000;
        if (now >= deadline) {
          host.close(1008, "Authentication Timeout (Active Eviction)");
        } else {
          earliestPending = Math.min(earliestPending, deadline);
        }
      }
    }

    // 精確排程：只在下一個最近逾時點喚醒，減少無謂喚醒
    if (earliestPending !== Infinity) {
      await this.state.storage.setAlarm(earliestPending);
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // 尺寸限制 (4KB)
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

    // 4. 第一幀握手認證（針對 host）
    if (attachment.role === "host" && !attachment.authed) {
      if (Date.now() - attachment.connectedAt > 5000) {
        ws.close(1008, "Authentication Timeout");
        return;
      }

      if (data.type === "AUTH" && typeof data.password === "string") {
        if (timingSafeEqual(data.password, this.env.HOST_PASSWORD!)) {
          attachment.authed = true;
          ws.serializeAttachment(attachment);
          ws.send(JSON.stringify({ type: "AUTH_SUCCESS" }));
          return;
        }
      }
      ws.close(1008, "Authentication Failed");
      return;
    }

    // 5. 業務安全路由轉發
    switch (data.type) {
      case "SUBMIT_QUESTION":
      case "UPVOTE": {
        // 觀眾提問/附議：嚴格只發給 authed: true 的主持人
        const hosts = this.state.getWebSockets("host");
        const payload = JSON.stringify(data);
        for (const host of hosts) {
          const att = host.deserializeAttachment() as WsAttachment;
          if (att?.authed) {
            try {
              host.send(payload);
            } catch (err) {
              console.error("[DO] Send to host failed:", err);
            }
          }
        }
        break;
      }

      case "SPOTLIGHT":
      case "APPROVE_QUESTION":
      case "SYNC_POOL": {
        // 廣播命令：嚴格限制只有通過認證的 host 可以發出
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
          try {
            target.send(payload);
          } catch (err) {
            console.error("[DO] Broadcast send failed:", err);
          }
        }
        break;
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    if (!wasClean && code !== 1000) {
      console.log(`[WS Close] code=${code} reason=${reason} wasClean=${wasClean}`);
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("[WS Error]", error);
    try { ws.close(1011, "Internal server error"); } catch {}
  }
}
