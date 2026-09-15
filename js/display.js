import { Relay } from './relay.js';

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || '888888';
document.getElementById('room-code-label').textContent = `房號：${roomId}`;

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
  const miniQr = document.getElementById('mini-qr');

  if (spotlight) {
    idleView.style.display = 'none';
    spotView.style.display = 'block';
    miniQr.style.display = 'block';

    document.getElementById('spot-text').textContent = spotlight.text;
    document.getElementById('spot-upvotes').textContent = `▲ +${spotlight.upvotes} 附議`;
  } else {
    idleView.style.display = 'block';
    spotView.style.display = 'none';
    miniQr.style.display = 'none';
  }
}
