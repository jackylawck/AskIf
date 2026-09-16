// backend/src/room-hub.ts
import { Env } from './types';

interface WsAttachment {
  role: "host" | "audience" | "display";
  authed: boolean;
  connectedAt: number;
}

// 常數時間字串比較，防禦時序側通道攻擊
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
      authed: !isHost, // 觀眾與大螢幕免認證；主持人初始未認證
      connectedAt: Date.now()
    };

    // 握手標籤固定，不進行二次 acceptWebSocket
    this.state.acceptWebSocket(server, [role]);
    server.serializeAttachment(initialData);

    // 2. 主動超時防禦：若有主持人連線進入，排程 5 秒後的 Alarm 主動稽核
    if (isHost) {
      const currentAlarm = await this.state.storage.getAlarm();
      if (currentAlarm === null) {
        await this.state.storage.setAlarm(Date.now() + 5000);
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  // 3. DO 原生鬧鐘：主動清理超時未認證的 host 連線（防慢速 DoS）
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

    if (earliestPending !== Infinity) {
      await this.state.storage.setAlarm(earliestPending);
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // 尺寸限制防禦 (4KB)
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

    // 4. 心跳保活回應
    if (data.type === "PING") {
      try {
        ws.send(JSON.stringify({ type: "PONG" }));
      } catch {}
      return;
    }

    // 5. 第一幀握手認證（僅針對 host）
    if (attachment.role === "host" && !attachment.authed) {
      if (Date.now() - attachment.connectedAt > 5000) {
        ws.close(1008, "Authentication Timeout");
        return;
      }

      if (data.type === "AUTH" && typeof data.password === "string") {
        if (timingSafeEqual(data.password, this.env.HOST_PASSWORD)) {
          attachment.authed = true;
          ws.serializeAttachment(attachment); // 跨 Hibernation 持久化狀態
          ws.send(JSON.stringify({ type: "AUTH_SUCCESS" }));
          return;
        }
      }
      ws.close(1008, "Authentication Failed");
      return;
    }

    // 6. 業務安全路由轉發（嚴格對齊 PROTOCOL.md v1.1.0）
    switch (data.type) {
      case "REQ_SYNC":
      case "SUBMIT_QUESTION":
      case "UPVOTE": {
        // 上行訊息：只定向轉發給 authed: true 的主持人
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
      case "SYNC_POOL": {
        // 下行廣播：嚴格限制只有通過認證的主持人能下達
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