// js/relay.js
export class Relay {
  constructor(roomId, role) {
    this.roomId = roomId;
    this.role = role;
    this.handlers = new Set();
    this.ws = null;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.connect();
  }

  connect() {
    // 清除舊連線與定時器
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    const baseHost = 'askif-relay.jackylawck.workers.dev';
    const cleanHost = baseHost.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${cleanHost}/room?room=${encodeURIComponent(this.roomId)}&role=${this.role.toLowerCase()}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // 啟動 25 秒定時 Heartbeat PING，防止 Cloudflare 邊緣中繼斷線
      this.pingTimer = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, 25000);

      // 若身份是 HOST，立即發送 AUTH 第一幀握手防超時踢除
      if (this.role.toUpperCase() === 'HOST') {
        this.send({
          type: 'AUTH',
          token: 'VALID_HOST_TICKET'
        });
      } else {
        this.emit({ type: 'STATUS', status: 'ONLINE' });
      }
    };

    this.ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch (err) {
        console.error('[Relay Parse Error]:', err);
        return;
      }

      // 忽略心跳 PONG 回應
      if (msg.type === 'PONG') return;

      // DO 握手成功處理
      if (msg.type === 'AUTH_SUCCESS') {
        this.emit({ type: 'STATUS', status: 'ONLINE' });
        return;
      }

      for (const handler of this.handlers) {
        try {
          handler(msg);
        } catch (handlerErr) {
          console.error('[Relay Handler Error]:', handlerErr);
        }
      }
    };

    this.ws.onclose = () => {
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      this.emit({ type: 'STATUS', status: 'OFFLINE' });
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      }
    };

    this.ws.onerror = () => {
      try { this.ws.close(); } catch {}
    };
  }

  onMessage(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(msg) {
    for (const handler of this.handlers) {
      try {
        handler(msg);
      } catch (err) {
        console.error('[Relay Emit Error]:', err);
      }
    }
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}