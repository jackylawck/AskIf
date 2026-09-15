// js/relay.js
export class Relay {
  #handlers = new Set();
  #statusHandlers = new Set();
  #ws = null;
  #password = null;
  #reconnectTimer = null;
  #heartbeatTimer = null;
  #pongReceived = true; // PONG 狀態追蹤
  #retryCount = 0;
  #maxRetries = 6;
  #isExplicitDisconnect = false;

  constructor(roomId, role = 'audience', password = null) {
    if (!roomId) {
      throw new Error('[Relay] Room ID is required');
    }
    this.roomId = roomId;
    this.role = role;
    this.#password = password;

    this.connect();
  }

  connect() {
    this.#isExplicitDisconnect = false;
    this.#clearTimers();
    this.#pongReceived = true; // 重置心跳追蹤

    if (this.#ws) {
      this.#ws.onopen = null;
      this.#ws.onmessage = null;
      this.#ws.onclose = null;
      this.#ws.onerror = null;
      try { this.#ws.close(1000, 'Reconnecting'); } catch {}
      this.#ws = null;
    }

    if (!window.ASKIF_RELAY) {
      console.error('[Relay] Missing window.ASKIF_RELAY configuration');
      this.#emitStatus({ type: 'STATUS', status: 'ERROR', message: 'Config missing' });
      return;
    }

    const relayBase = window.ASKIF_RELAY.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
    const wsUrl = `${relayBase}/room?room=${encodeURIComponent(this.roomId)}&role=${encodeURIComponent(this.role)}`;
    
    this.#emitStatus({ type: 'STATUS', status: 'CONNECTING' });
    this.#ws = new WebSocket(wsUrl);

    this.#ws.onopen = () => {
      // 1. 主持人憑密碼第一幀握手認證
      if (this.role === 'host' && this.#password) {
        this.#emitStatus({ type: 'STATUS', status: 'AUTHENTICATING' });
        this.#ws.send(JSON.stringify({
          type: 'AUTH',
          password: this.#password
        }));
      } else {
        this.#retryCount = 0;
        this.#emitStatus({ type: 'STATUS', status: 'ONLINE' });
      }

      // 2. 啟動 30 秒「PING-PONG 雙向檢測」
      this.#heartbeatTimer = setInterval(() => {
        if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
          // 若上一輪發送 PING 後，30 秒內伺服器未回應 PONG，視為 TCP 半開死鎖
          if (!this.#pongReceived) {
            console.warn('[Relay] PONG timeout detected (half-open socket). Forcing reconnect.');
            try {
              this.#ws.close(4000, 'PONG Timeout');
            } catch {}
            return; // 修正：主動關閉後立即中斷，禁止繼續送出 PING
          }

          // 準備發出新一輪檢測，重設標記
          this.#pongReceived = false;
          this.#ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, 30000);
    };

    this.#ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      // 收到伺服器 PONG，確認雙向鏈路健康
      if (data.type === 'PONG') {
        this.#pongReceived = true;
        return;
      }

      // 認證成功升級
      if (data.type === 'AUTH_SUCCESS') {
        this.#retryCount = 0;
        this.#emitStatus({ type: 'STATUS', status: 'ONLINE' });
        return;
      }

      // 派發業務訊息至外部監聽器
      this.#emitMessage(data);
    };

    this.#ws.onclose = (e) => {
      this.#clearTimers();

      if (this.#isExplicitDisconnect) {
        this.#emitStatus({ type: 'STATUS', status: 'CLOSED' });
        return;
      }

      // 不可重試關閉碼分流（正常退出、密碼錯誤、授權拒絕）
      if (e.code === 1000 || e.code === 1008 || e.code === 4001 || e.code === 4003) {
        if (e.code === 1008) {
          this.#emitStatus({ type: 'STATUS', status: 'AUTH_FAILED', code: e.code, reason: e.reason });
        } else {
          this.#emitStatus({ type: 'STATUS', status: 'CLOSED', code: e.code, reason: e.reason });
        }
        return;
      }

      // 異常斷線（含 PONG 超時 4000、邊緣節點中斷 1006 等）：啟動 Jitter 指數退避重連
      this.#emitStatus({ type: 'STATUS', status: 'OFFLINE', code: e.code });

      if (this.#retryCount < this.#maxRetries) {
        const baseDelay = Math.min(1000 * Math.pow(2, this.#retryCount), 30000);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        this.#retryCount++;
        this.#reconnectTimer = setTimeout(() => {
          this.#reconnectTimer = null;
          this.connect();
        }, delay);
      } else {
        this.#emitStatus({ type: 'STATUS', status: 'FAILED', message: 'Max retries reached' });
      }
    };

    this.#ws.onerror = (err) => {
      console.error('[Relay WS Error]:', err);
    };
  }

  send(payload) {
    if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
      try {
        // 修正：相容字串與物件，避免字串被二次 JSON.stringify
        const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
        this.#ws.send(data);
        return true;
      } catch (err) {
        console.error('[Relay Send Error]:', err);
        return false;
      }
    }
    console.warn('[Relay] Send failed: WebSocket is not open', typeof payload === 'object' ? payload?.type : 'STRING_PAYLOAD');
    return false;
  }

  onMessage(callback) {
    this.#handlers.add(callback);
    return () => this.#handlers.delete(callback);
  }

  onStatus(callback) {
    this.#statusHandlers.add(callback);
    return () => this.#statusHandlers.delete(callback);
  }

  disconnect() {
    this.#isExplicitDisconnect = true;
    this.#clearTimers();

    if (this.#ws) {
      this.#ws.onopen = null;
      this.#ws.onmessage = null;
      this.#ws.onclose = null;
      this.#ws.onerror = null;
      try { this.#ws.close(1000, 'User disconnect'); } catch {}
      this.#ws = null;
    }
    this.#handlers.clear();
    this.#statusHandlers.clear();
  }

  #emitMessage(data) {
    for (const handler of this.#handlers) {
      try { handler(data); } catch (err) {
        console.error('[Relay Message Handler Error]:', err);
      }
    }
  }

  #emitStatus(statusObj) {
    for (const handler of this.#statusHandlers) {
      try { handler(statusObj); } catch (err) {
        console.error('[Relay Status Handler Error]:', err);
      }
    }
  }

  #clearTimers() {
    if (this.#heartbeatTimer) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
  }
}
