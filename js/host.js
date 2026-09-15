// js/host.js
let ws = null;
let retryCount = 0;
const MAX_RETRIES = 6;
let reconnectTimer = null;
let heartbeatTimer = null;
let pongReceived = true;

// 1. 基礎參數與環境校驗
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if (!roomId) {
  alert("缺少房號參數！");
  window.location.href = "./index.html";
  throw new Error("[Host] Missing room ID");
}

if (!window.ASKIF_RELAY) {
  console.error("[CRITICAL] ASKIF_RELAY not defined in config.js");
  alert("系統配置錯誤：找不到轉發伺服器位址。");
}

function updateBadge(statusText, className) {
  const badge = document.getElementById("sync-badge");
  if (badge) {
    badge.textContent = statusText;
    badge.className = `badge ${className}`;
  }
}

function clearTimers() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function connectHost() {
  // 2. 清理舊連線與計時器，徹底杜絕幽靈連線
  clearTimers();
  pongReceived = true;

  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    try { ws.close(); } catch {}
    ws = null;
  }

  // 3. 取得主持人授權密碼（嚴格控制流阻斷）
  let hostPassword = sessionStorage.getItem('askif_pwd');
  if (!hostPassword) {
    const promptMsg = window.t ? window.t('input_pwd_prompt') || "請輸入主持人管理密碼：" : "請輸入主持人管理密碼：";
    hostPassword = prompt(promptMsg);
    if (!hostPassword) {
      alert("必須輸入密碼才能管理房間！");
      window.location.href = "./index.html";
      return; // 阻止後續程式碼執行
    }
    sessionStorage.setItem('askif_pwd', hostPassword);
  }

  updateBadge(window.t ? window.t('status_syncing') || "連線中..." : "連線中...", "badge-peer");

  const relayBase = window.ASKIF_RELAY.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  const wsUrl = `${relayBase}/room?room=${encodeURIComponent(roomId)}&role=host`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    updateBadge("驗證權限中...", "badge-peer");
    
    // 握手成功第一幀：立即發送密碼認證包
    ws.send(JSON.stringify({
      type: "AUTH",
      password: hostPassword
    }));

    // 啟動 30 秒雙向心跳保活（含 PONG 超時檢測）
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        if (!pongReceived) {
          console.warn("[Host WS] PONG 超時，連線可能已假死，強制重連");
          try { ws.close(4000, "PONG Timeout"); } catch {}
          return;
        }
        pongReceived = false;
        ws.send(JSON.stringify({ type: "PING" }));
      }
    }, 30000);
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type === "PONG") {
      pongReceived = true; // 心跳正常
      return;
    }

    if (msg.type === "AUTH_SUCCESS") {
      retryCount = 0; // 重設指數退避計數
      updateBadge(window.t ? window.t('status_connected') || "● 已同步雲端中繼" : "● 已同步雲端中繼", "badge-online");
      return;
    }

    // 呼叫業務渲染函式
    if (typeof handleIncomingMessage === "function") {
      handleIncomingMessage(msg);
    }
  };

  ws.onclose = (e) => {
    clearTimers();

    // 4. 不可重試關閉碼分流
    if (e.code === 1000 || e.code === 1008 || e.code === 4001) {
      if (e.code === 1008) {
        sessionStorage.removeItem('askif_pwd');
        updateBadge("密碼錯誤", "badge-offline");
        alert("主持人密碼錯誤！請重新輸入。");
        setTimeout(connectHost, 0);
      } else {
        updateBadge("連線已終止", "badge-offline");
      }
      return;
    }

    // 5. 異常斷線（含 1006、4000 等）：指數退避 + Jitter
    updateBadge(window.t ? window.t('status_reconnecting') || "○ 斷線重試中..." : "○ 斷線重試中...", "badge-offline");

    if (retryCount < MAX_RETRIES) {
      const baseDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      retryCount++;
      reconnectTimer = setTimeout(connectHost, delay);
    } else {
      alert("與伺服器連線中斷，請檢查網路連線後重新整理頁面。");
    }
  };

  ws.onerror = (err) => {
    console.error("[Host WS Error]:", err);
  };
}

// 頁面卸載時清理連線
window.addEventListener('beforeunload', () => {
  clearTimers();
  if (ws) {
    try { ws.close(1000, "Page Unload"); } catch {}
  }
});

// 啟動連線流程
connectHost();
