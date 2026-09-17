import { Relay } from './relay.js';

const urlParams = new URLSearchParams(window.location.search);
const rawRoom = urlParams.get('room') || '888888';
// 確保取到純 6 位房號（避免誤帶長票據）
const roomId = rawRoom.includes('.') ? rawRoom.split('.')[0] : rawRoom;

const labelEl = document.getElementById('room-code-label');
if (labelEl) {
  labelEl.textContent = `房號 Room: ${roomId}`;
}

const audienceUrl = new URL(`./audience.html?room=${encodeURIComponent(roomId)}`, window.location.href).href;

function renderQrImage(containerId, qrInstance, cellSize, margin) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();

  const img = document.createElement('img');
  img.src = qrInstance.createDataURL(cellSize, margin);
  img.alt = 'QR Code';
  img.style.display = 'block';
  container.appendChild(img);
}

if (typeof qrcode === 'function') {
  const qr = qrcode(0, 'M');
  qr.addData(audienceUrl);
  qr.make();
  renderQrImage('main-qr', qr, 6, 12);
  renderQrImage('mini-qr', qr, 2, 4);
} else {
  console.warn('[QR Vendor missing]: 請確認引入 qrcode-generator');
}

const relay = new Relay(roomId, 'DISPLAY');
let lastVersion = 0;

relay.onMessage((msg) => {
  if (msg.type === 'STATUS' && msg.status === 'ONLINE') {
    relay.send({ type: 'REQ_SYNC' });
    return;
  }

  if (msg.type === 'STATE') {
    if (msg.version <= lastVersion) return;
    lastVersion = msg.version;
    render(msg.spotlight);
  }
});

function render(spotlight) {
  const idleView = document.getElementById('idle-view');
  const spotView = document.getElementById('spotlight-view');
  // 選取外層包裝盒，若無則回退選取 mini-qr
  const miniBox = document.getElementById('mini-qr-box') || document.getElementById('mini-qr');

  if (spotlight) {
    idleView.style.display = 'none';
    spotView.style.display = 'block';
    if (miniBox) miniBox.style.display = 'block';

    const textEl = document.getElementById('spot-text');
    const upvotesEl = document.getElementById('spot-upvotes');

    if (textEl) textEl.textContent = spotlight.text;
    if (upvotesEl) upvotesEl.textContent = `▲ +${spotlight.upvotes} 附議 / Upvotes`;
  } else {
    idleView.style.display = 'block';
    spotView.style.display = 'none';
    if (miniBox) miniBox.style.display = 'none';
  }
}