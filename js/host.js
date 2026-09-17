import { Relay } from './relay.js';
import { getSavedLang, TRANSLATIONS } from './i18n.js';

const urlParams = new URLSearchParams(window.location.search);
const rawTicket = urlParams.get('room') || '888888';
const roomId = rawTicket.includes('.') ? rawTicket.split('.')[0] : rawTicket;

// 🔑 1. 即焚金鑰安全接收並抹除 Hash
if (window.location.hash.startsWith('#key=')) {
  const hashKey = decodeURIComponent(window.location.hash.substring(5));
  sessionStorage.setItem(`askif_host_pwd_${roomId}`, hashKey);
  sessionStorage.setItem(`askif_host_pwd_${rawTicket}`, hashKey);
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

// 🛡️ 2. 防禦性綁定與賦值（完全杜絕第 5 行 null 報錯）
function initHostUI() {
  const roomLabel = document.getElementById('room-id-label');
  if (roomLabel) roomLabel.textContent = roomId;

  const displayBtn = document.getElementById('open-display-btn');
  if (displayBtn) displayBtn.href = `./display.html?room=${encodeURIComponent(roomId)}`;

  const backBtn = document.getElementById('btn-back-home');
  if (backBtn) {
    backBtn.onclick = () => {
      const dict = getDict();
      if (confirm(dict.confirmLeave || '確定要結束管理並返回首頁嗎？')) {
        window.location.href = './index.html';
      }
    };
  }

  // 渲染二維碼
  const audienceUrl = new URL(`./audience.html?room=${encodeURIComponent(roomId)}`, window.location.href).href;
  if (typeof qrcode === 'function') {
    const qr = qrcode(0, 'M');
    qr.addData(audienceUrl);
    qr.make();
    const hostQrBox = document.getElementById('host-qr');
    if (hostQrBox) {
      hostQrBox.replaceChildren();
      const img = document.createElement('img');
      img.src = qr.createDataURL(3, 6);
      img.alt = 'QR Code';
      hostQrBox.appendChild(img);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHostUI);
} else {
  initHostUI();
}

// 3. 連線中繼
const relay = new Relay(rawTicket, 'HOST');