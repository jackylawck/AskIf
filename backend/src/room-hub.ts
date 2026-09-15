export class RoomHub implements DurableObject {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // 使用 Cloudflare 內建追蹤，相容休眠機制 (Hibernation)
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const all = this.state.getWebSockets();
    for (const socket of all) {
      if (socket === ws) continue;
      try {
        socket.send(message);
      } catch {
        // 已中斷的 socket 由系統自動回收
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try { ws.close(); } catch {}
  }
}
