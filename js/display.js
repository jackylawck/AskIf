// js/display.js
import { Relay } from './relay.js';

// 錯誤渲染輔助函式：全站 0 innerHTML 防禦紀律
function renderError(message) {
  const errBox = document.getElementById('error-display') || document.body;
  const errDiv = document.createElement('div');
  errDiv.style.cssText = 'color:#ef4444;font-size:24px;padding:24px;text-align:center;font-weight:600;';
  errDiv.textContent = message;
  errBox.replaceChildren(errDiv);
}

// 1. 票據與房號檢驗（杜絕 fallback，保證 QR Code 與連線均使用合法 Ticket）
const urlParams = new URLSearchParams(window.location.search);
const roomTicket = urlParams.get('room');

if (!roomTicket) {
  renderError('缺少房號票據，請由主持人頁面連結開啟大螢幕！');
  throw new Error('[Display] Missing room ticket');
}

const parts = roomTicket.split('.');
if (parts.length !== 3 || !/^\d{6}$/.test(parts[0])) {
  renderError('票據格式錯誤，請重新進入！');
  throw new Error('[Display] Invalid room ticket structure');
}
const roomId = parts[0];

// 2. 密碼學安全 Client ID（大螢幕專屬身分）
function generateDisplayClientId() {
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  return 'c_disp_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
const clientId = generateDisplayClientId();

// 3. 獨立雙軌版本流（題庫與焦點題各自獨立單調遞增）
let lastPoolVersion = -1;
let lastSpotlightVersion = -1;

// 4. 動態產生現場觀眾端 QR Code（嚴格攜帶完整 Ticket）
function initQrCode() {
  const qrContainer = document.getElementById('qrcode');
  if (!qrContainer) return;

  const audienceUrl = new URL(`./audience.html?room=${encodeURIComponent(roomTicket)}`, window.location.href).href;
  
  // 顯示純數字房號供現場口播
  const roomNumEl = document.getElementById('room-number-text');
  if (roomNumEl) {
    roomNumEl.textContent = `房號：${roomId}`;
  }

  qrContainer.replaceChildren(); // 清空原有節點

  if (typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: audienceUrl,
      width: 180,
      height: 180,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    // 降級文字備選
    const linkEl = document.createElement('a');
    linkEl.href = audienceUrl;
    linkEl.textContent = '觀眾端入口';
    linkEl.target = '_blank';
    qrContainer.replaceChildren(linkEl);
  }
}

initQrCode();

// 5. 實例化統一通訊客戶端（role: 'display' 小寫，免密碼）
const relay = new Relay(roomTicket, 'display');

// 6. 狀態監聽 (onStatus 通道，連線成功主動請求同步)
const unsubStatus = relay.onStatus((event) => {
  const statusDot = document.getElementById('display-status-dot');
  
  switch (event.status) {
    case 'ONLINE':
      if (statusDot) {
        statusDot.className = 'badge badge-online';
        statusDot.textContent = '● 雲端已同步';
      }
      // 上線主動送出 REQ_SYNC 促使主持人立即廣播基線狀態
      relay.send({ type: 'REQ_SYNC', cid: clientId });
      break;
    case 'CONNECTING':
      if (statusDot) {
        statusDot.className = 'badge badge-peer';
        statusDot.textContent = '◌ 連線中';
      }
      break;
    case 'OFFLINE':
      if (statusDot) {
        statusDot.className = 'badge badge-danger';
        statusDot.textContent = '○ 斷線重試中';
      }
      break;
    case 'FAILED':
      if (statusDot) {
        statusDot.className = 'badge badge-danger';
        statusDot.textContent = '✕ 連線失敗';
      }
      break;
    case 'CLOSED':
      if (statusDot) {
        statusDot.className = 'badge badge-danger';
        statusDot.textContent = '○ 活動已結束';
      }
      break;
  }
});

// 7. 業務訊息監聽 (onMessage 通道，對齊 PROTOCOL.md v1.1.0)
const unsubMessage = relay.onMessage((msg) => {
  switch (msg.type) {
    case 'SYNC_POOL': {
      // 題庫版本流過濾
      if (typeof msg.version === 'number') {
        if (msg.version <= lastPoolVersion) return;
        lastPoolVersion = msg.version;
      }
      if (Array.isArray(msg.questions)) {
        renderLeaderboard(msg.questions);
      }
      break;
    }

    case 'SPOTLIGHT': {
      // 焦點版本流過濾
      if (typeof msg.version === 'number') {
        if (msg.version <= lastSpotlightVersion) return;
        lastSpotlightVersion = msg.version;
      }
      renderSpotlight(msg.question);
      break;
    }
  }
});

// 8. 渲染焦點題目（支援 null 取消焦點語意）
function renderSpotlight(question) {
  const spotlightContainer = document.getElementById('spotlight-container');
  const standbyContainer = document.getElementById('standby-container');
  const spotlightText = document.getElementById('spotlight-text');
  const spotlightMeta = document.getElementById('spotlight-meta');

  if (!spotlightContainer || !standbyContainer) return;

  // 若 question 為 null 或空字串，平滑切換回待機狀態
  if (!question || !question.text) {
    spotlightContainer.style.display = 'none';
    standbyContainer.style.display = 'block';
    if (spotlightText) spotlightText.textContent = '';
    return;
  }

  // 啟用焦點大卡
  standbyContainer.style.display = 'none';
  spotlightContainer.style.display = 'block';

  if (spotlightText) {
    spotlightText.textContent = question.text; // textContent 防 XSS
  }
  if (spotlightMeta) {
    spotlightMeta.textContent = typeof question.upvotes === 'number' 
      ? `▲ 獲得附議數：${question.upvotes}` 
      : '';
  }
}

// 9. 渲染精選看板（若大螢幕右側/下方有題庫榜單）
function renderLeaderboard(questions) {
  const boardEl = document.getElementById('leaderboard-list');
  if (!boardEl) return;

  const sorted = [...questions].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 5);
  const fragment = document.createDocumentFragment();

  for (const q of sorted) {
    const item = document.createElement('li');
    item.className = 'leaderboard-item';

    const textSpan = document.createElement('span');
    textSpan.className = 'item-text';
    textSpan.textContent = q.text;

    const voteSpan = document.createElement('span');
    voteSpan.className = 'item-votes';
    voteSpan.textContent = `▲ ${q.upvotes || 0}`;

    item.appendChild(textSpan);
    item.appendChild(voteSpan);
    fragment.appendChild(item);
  }

  boardEl.replaceChildren(fragment);
}

// 10. 生命週期完整清理
window.addEventListener('beforeunload', () => {
  unsubStatus?.();
  unsubMessage?.();
  relay?.disconnect();
});
