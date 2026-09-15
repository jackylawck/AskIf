// js/host.js
let ws = null;
let retryCount = 0;
const MAX_RETRIES = 6;
let reconnectTimer = null;

// 從 URL 取得 room 參數
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if (!roomId) {
  alert("缺少房號參數！");
  window.location.href = "./index.html";
}

function updateBadge(statusText, className) {
  const badge = document.getElementById("sync-badge");
  if (badge) {
    badge.textContent = statusText;
    badge.className = `badge ${className}`;
  }
}

function connectHost() {
  // 1. 防禦：清理舊連線與定時器，防止多重連線競爭
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    try { ws.close(); } catch {}
    ws = null;
  }

  // 2. 密碼讀取與驗證
  let hostPassword = sessionStorage.getItem('askif_pwd');
  if (!hostPassword) {
    const promptMsg = window.t ? window.t('input_pwd_prompt') || "請輸入主持人管理密碼：" : "請輸入主持人管理密碼：";
    hostPassword = prompt(promptMsg);
    if (!hostPassword) {
      alert("必須輸入密碼才能管理房間！");
      window.location.href = "./index.html";
      return;
    }
    sessionStorage.setItem('askif_pwd', hostPassword);
  }

  updateBadge(window.t ? window.t('status_syncing') : "連線同步中...", "badge-peer");

  const wsUrl = `${window.ASKIF_RELAY.replace('https://', 'wss://')}/room?room=${roomId}&role=host`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    // 握手成功第一幀：立即發送 AUTH 驗證
    ws.send(JSON.stringify({
      type: "AUTH",
      password: hostPassword
    }));
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type === "AUTH_SUCCESS") {
      retryCount = 0; // 成功認證後重設重試次數
      updateBadge(window.t ? window.t('status_connected') : "● 已同步雲端中繼", "badge-online");
      return;
    }

    if (typeof handleIncomingMessage === "function") {
      handleIncomingMessage(msg);
    }
  };

  ws.onclose = (e) => {
    // 密碼驗證失敗
    if (e.code === 1008) {
      sessionStorage.removeItem('askif_pwd');
      updateBadge("密碼錯誤", "badge-offline");
      alert("主持人密碼錯誤！請重新輸入。");
      connectHost();
      return;
    }

    updateBadge(window.t ? window.t('status_reconnecting') : "○ 斷線重試中...", "badge-offline");

    // 指數退避重連 (1s, 2s, 4s, 8s, 16s, 最長 30s)
    if (retryCount < MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      retryCount++;
      reconnectTimer = setTimeout(connectHost, delay);
    } else {
      alert("與伺服器連線中斷，請檢查網路連線後重新整理分頁。");
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket network error:", err);
  };
}

// 啟動連線
connectHost();
