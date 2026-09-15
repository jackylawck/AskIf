// js/display.js
import { Relay } from './relay.js';
import { t } from './i18n.js';

function renderError(message) {
  const errBox = document.getElementById('error-display') || document.body;
  const errDiv = document.createElement('div');
  errDiv.style.cssText = 'position:fixed;inset:0;background:#0d0f12;color:#ef4444;font-size:24px;display:flex;align-items:center;justify-content:center;font-weight:600;z-index:9999;';
  errDiv.textContent = message;
  errBox.replaceChildren(errDiv);
}

// 1. 票據驗證
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

// 2. Client ID
function generateDisplayClientId() {
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  return 'c_disp_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
const clientId = generateDisplayClientId();

let lastPoolVersion = -1;
let lastSpotlightVersion = -1;

// 3. QR Code 渲染輔助
function generateQrElement(url, cellSize) {
  if (typeof qrcode !== 'function') {
    throw new Error('QRCode generator library unavailable');
  }
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const img = document.createElement('img');
  img.src = qr.createDataURL(cellSize, 0);
  img.style.width = '100%';
  img.style.height = '100%';
  img.alt = 'QR Code';
  return img;
}

function initQrCode() {
  const mainQrContainer = document.getElementById('main-qr');
  const miniQrContainer = document.getElementById('mini-qr');
  const roomCodeEl = document.getElementById('room-code-text');

  if (roomCodeEl) {
    roomCodeEl.textContent = roomId;
  }

  const audienceUrl = new URL(`./audience.html?room=${encodeURIComponent(roomTicket)}`, window.location.href).href;

  try {
    if (mainQrContainer) {
      mainQrContainer.replaceChildren(generateQrElement(audienceUrl, 8));
    }
    if (miniQrContainer) {
      miniQrContainer.replaceChildren(generateQrElement(audienceUrl, 4));
    }
  } catch (err) {
    console.warn('[Display QR] Fallback', err);
    if (mainQrContainer) {
      const linkEl = document.createElement('a');
      linkEl.href = audienceUrl;
      linkEl.textContent = '觀眾端入口連結';
      linkEl.target = '_blank';
      linkEl.style.color = '#4a9eff';
      mainQrContainer.replaceChildren(linkEl);
    }
  }
}

initQrCode();

// 4. 連線實例化
const relay = new Relay(roomTicket, 'display');

// 5. 狀態更新與多語言連動
let currentStatus = 'CONNECTING';

function updateStatusUI(status) {
  currentStatus = status;
  const statusDot = document.getElementById('display-status-dot');
  if (!statusDot) return;

  switch (status) {
    case 'ONLINE':
      statusDot.className = 'status-badge badge-online';
      statusDot.textContent = t('status_connected');
      break;
    case 'CONNECTING':
      statusDot.className = 'status-badge';
      statusDot.textContent = t('status_connecting');
      break;
    case 'OFFLINE':
      statusDot.className = 'status-badge badge-danger';
      statusDot.textContent = t('status_reconnecting');
      break;
    case 'FAILED':
      statusDot.className = 'status-badge badge-danger';
      statusDot.textContent = t('status_failed');
      break;
    case 'CLOSED':
      statusDot.className = 'status-badge badge-danger';
      statusDot.textContent = t('status_closed');
      break;
  }
}

const unsubStatus = relay.onStatus((event) => {
  updateStatusUI(event.status);
  if (event.status === 'ONLINE') {
    relay.send({ type: 'REQ_SYNC', cid: clientId });
  }
});

const onLangChange = () => updateStatusUI(currentStatus);
window.addEventListener('languagechange', onLangChange);

// 6. 業務監聽
const unsubMessage = relay.onMessage((msg) => {
  switch (msg.type) {
    case 'SYNC_POOL': {
      if (typeof msg.version === 'number') {
        if (msg.version <= lastPoolVersion) return;
        lastPoolVersion = msg.version;
      }
      break;
    }

    case 'SPOTLIGHT': {
      if (typeof msg.version === 'number') {
        if (msg.version <= lastSpotlightVersion) return;
        lastSpotlightVersion = msg.version;
      }
      renderSpotlight(msg.question);
      break;
    }
  }
});

// 7. 焦點切換渲染（支援 mini-qr 浮現）
function renderSpotlight(question) {
  const idleView = document.getElementById('idle-view');
  const spotlightView = document.getElementById('spotlight-view');
  const miniQr = document.getElementById('mini-qr');
  const spotText = document.getElementById('spot-text');
  const spotUpvotes = document.getElementById('spot-upvotes-count');

  if (!idleView || !spotlightView) return;

  if (!question || !question.text) {
    spotlightView.style.display = 'none';
    idleView.style.display = 'block';
    if (miniQr) miniQr.style.display = 'none';
    if (spotText) spotText.textContent = '';
    if (spotUpvotes) spotUpvotes.textContent = '0';
    return;
  }

  idleView.style.display = 'none';
  spotlightView.style.display = 'block';
  if (miniQr) miniQr.style.display = 'block';

  if (spotText) {
    spotText.textContent = question.text;
  }
  if (spotUpvotes) {
    spotUpvotes.textContent = String(question.upvotes || 0);
  }
}

// 8. 卸載清理
window.addEventListener('beforeunload', () => {
  window.removeEventListener('languagechange', onLangChange);
  unsubStatus?.();
  unsubMessage?.();
  relay?.disconnect();
});
