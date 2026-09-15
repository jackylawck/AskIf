// js/host.js
import { Relay } from './relay.js';
import { t } from './i18n.js';

// 1. 票據與房號檢驗
const urlParams = new URLSearchParams(window.location.search);
const roomTicket = urlParams.get('room');

if (!roomTicket) {
  alert('缺少房號票據！');
  window.location.href = './index.html';
  throw new Error('[Host] Missing room ticket');
}

const parts = roomTicket.split('.');
if (parts.length !== 3 || !/^\d{6}$/.test(parts[0])) {
  alert('房號票據格式錯誤，請重新開房！');
  window.location.href = './index.html';
  throw new Error('[Host] Invalid room ticket format');
}
const roomId = parts[0];

// 2. DOM 基礎掛載
const roomIdLabel = document.getElementById('room-id-label');
if (roomIdLabel) roomIdLabel.textContent = roomId;

const openDisplayBtn = document.getElementById('open-display-btn');
if (openDisplayBtn) {
  openDisplayBtn.href = `./display.html?room=${encodeURIComponent(roomTicket)}`;
}

// 產生主持人專屬 QR 碼
function initHostQr() {
  const qrBox = document.getElementById('host-qr');
  if (!qrBox) return;

  const audienceUrl = new URL(`./audience.html?room=${encodeURIComponent(roomTicket)}`, window.location.href).href;
  try {
    if (typeof qrcode === 'function') {
      const qr = qrcode(0, 'M');
      qr.addData(audienceUrl);
      qr.make();
      const img = document.createElement('img');
      img.src = qr.createDataURL(4, 0);
      img.style.width = '100%';
      img.style.height = '100%';
      img.alt = 'QR Code';
      qrBox.replaceChildren(img);
    }
  } catch (e) {
    console.warn('[Host QR] Fallback', e);
  }
}
initHostQr();

// 3. 連線狀態多語言連動
let currentConnectionStatus = 'CONNECTING';

function updateBadge(status) {
  currentConnectionStatus = status;
  const badge = document.getElementById('sync-badge');
  if (!badge) return;

  switch (status) {
    case 'CONNECTING':
    case 'AUTHENTICATING':
      badge.textContent = t('status_connecting');
      badge.className = 'badge badge-peer';
      break;
    case 'ONLINE':
      badge.textContent = t('status_connected');
      badge.className = 'badge badge-online';
      break;
    case 'OFFLINE':
      badge.textContent = t('status_reconnecting');
      badge.className = 'badge badge-offline';
      break;
    case 'CLOSED':
      badge.textContent = t('status_closed');
      badge.className = 'badge badge-offline';
      break;
    case 'AUTH_FAILED':
      badge.textContent = t('pwd_error');
      badge.className = 'badge badge-danger';
      break;
  }
}

// 4. 主持人授權
let hostPassword = sessionStorage.getItem('askif_pwd');
if (!hostPassword) {
  hostPassword = prompt(t('input_pwd_prompt'));
  if (!hostPassword) {
    alert('必須輸入密碼才能管理房間！');
    window.location.href = './index.html';
    throw new Error('[Host] Authentication cancelled.');
  }
  sessionStorage.setItem('askif_pwd', hostPassword);
}

// 5. 狀態復原與持久化
const STORAGE_KEYS = {
  POOL_VER: `askif_host_pver_${roomId}`,
  SPOT_VER: `askif_host_sver_${roomId}`,
  POOL: `askif_host_pool_${roomId}`,
  SPOTLIGHT: `askif_host_spot_${roomId}`,
  UPVOTES: `askif_host_upvotes_${roomId}`
};

let poolVersion = Number(sessionStorage.getItem(STORAGE_KEYS.POOL_VER) || '0');
let spotlightVersion = Number(sessionStorage.getItem(STORAGE_KEYS.SPOT_VER) || '0');
let approvedPool = [];
let pendingInbox = []; // 待審核暫存陣列
let currentSpotlight = null;
let upvoteRecord = new Set();

try {
  approvedPool = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.POOL) || '[]');
  currentSpotlight = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.SPOTLIGHT) || 'null');
  upvoteRecord = new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEYS.UPVOTES) || '[]'));
} catch (e) {
  console.warn('[Host] Failed to hydrate state from sessionStorage', e);
}

function pruneUpvoteRecord() {
  const activeQids = new Set(approvedPool.map(q => q.qid));
  for (const recordKey of upvoteRecord) {
    const qid = recordKey.split(':')[0];
    if (!activeQids.has(qid)) {
      upvoteRecord.delete(recordKey);
    }
  }
}

function persistState() {
  try {
    sessionStorage.setItem(STORAGE_KEYS.POOL_VER, String(poolVersion));
    sessionStorage.setItem(STORAGE_KEYS.SPOT_VER, String(spotlightVersion));
    sessionStorage.setItem(STORAGE_KEYS.POOL, JSON.stringify(approvedPool));
    sessionStorage.setItem(STORAGE_KEYS.SPOTLIGHT, JSON.stringify(currentSpotlight));
    sessionStorage.setItem(STORAGE_KEYS.UPVOTES, JSON.stringify([...upvoteRecord]));
  } catch (err) {
    console.error('[Host] State persistence error', err);
  }
}

// 6. 廣播引擎
let poolBroadcastTimer = null;
let reqSyncDebounceTimer = null;

function broadcastSyncPoolImmediate() {
  if (poolBroadcastTimer) {
    clearTimeout(poolBroadcastTimer);
    poolBroadcastTimer = null;
  }
  poolVersion++;
  persistState();
  relay.send({
    type: 'SYNC_POOL',
    questions: approvedPool,
    version: poolVersion
  });
}

function scheduleSyncPoolBroadcast() {
  if (poolBroadcastTimer) return;
  poolBroadcastTimer = setTimeout(() => {
    poolBroadcastTimer = null;
    broadcastSyncPoolImmediate();
  }, 500);
}

function scheduleReqSyncResponse() {
  if (reqSyncDebounceTimer) return;
  reqSyncDebounceTimer = setTimeout(() => {
    reqSyncDebounceTimer = null;
    broadcastSyncPoolImmediate();
    if (currentSpotlight) {
      relay.send({
        type: 'SPOTLIGHT',
        question: currentSpotlight,
        version: spotlightVersion
      });
    }
  }, 300);
}

export function broadcastSpotlight(questionOrNull) {
  currentSpotlight = questionOrNull;
  spotlightVersion++;
  persistState();
  relay.send({
    type: 'SPOTLIGHT',
    question: currentSpotlight,
    version: spotlightVersion
  });
  renderHostView();
}

// 7. 通訊客戶端
const relay = new Relay(roomTicket, 'host', hostPassword);

const unsubStatus = relay.onStatus((event) => {
  updateBadge(event.status);
  switch (event.status) {
    case 'ONLINE':
      scheduleReqSyncResponse();
      break;
    case 'AUTH_FAILED':
      sessionStorage.removeItem('askif_pwd');
      alert('密碼錯誤！請重新整理後輸入正確密碼。');
      relay.disconnect();
      window.location.reload();
      break;
    case 'FAILED':
      alert('與中繼伺服器中斷連線，請檢查現場網路。');
      break;
  }
});

const onLangChange = () => {
  updateBadge(currentConnectionStatus);
  renderHostView();
};
window.addEventListener('languagechange', onLangChange);

// 8. 業務訊息監聽
const unsubMessage = relay.onMessage((msg) => {
  switch (msg.type) {
    case 'REQ_SYNC': {
      scheduleReqSyncResponse();
      break;
    }
    case 'SUBMIT_QUESTION': {
      if (typeof msg.text === 'string' && msg.text.trim()) {
        pendingInbox.push({
          tempId: 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          text: msg.text.trim()
        });
        renderHostView();
      }
      break;
    }
    case 'UPVOTE': {
      const { qid, cid } = msg;
      if (!qid || !cid) return;

      const dedupeKey = `${qid}:${cid}`;
      if (upvoteRecord.has(dedupeKey)) return;

      const target = approvedPool.find(q => q.qid === qid);
      if (target) {
        upvoteRecord.add(dedupeKey);
        target.upvotes = (target.upvotes || 0) + 1;
        persistState();
        scheduleSyncPoolBroadcast();
        renderHostView();
      }
      break;
    }
  }
});

// 9. 題目管理與操作
export function approveQuestion(tempId, text) {
  pendingInbox = pendingInbox.filter(item => item.tempId !== tempId);
  
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  const randomHex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  const qid = `q_${Date.now()}_${randomHex}`;

  approvedPool.push({ qid, text, upvotes: 0 });
  persistState();
  broadcastSyncPoolImmediate();
  renderHostView();
}

export function rejectQuestion(tempId) {
  pendingInbox = pendingInbox.filter(item => item.tempId !== tempId);
  renderHostView();
}

export function removeQuestion(qid) {
  approvedPool = approvedPool.filter(q => q.qid !== qid);
  if (currentSpotlight && currentSpotlight.qid === qid) {
    broadcastSpotlight(null);
  }
  pruneUpvoteRecord();
  persistState();
  broadcastSyncPoolImmediate();
  renderHostView();
}

// 10. UI 渲染函式（純安全 DOM 節點構建，0 innerHTML）
function renderHostView() {
  // 更新計數器
  const inboxCount = document.getElementById('inbox-count');
  const approvedCount = document.getElementById('approved-count');
  if (inboxCount) inboxCount.textContent = String(pendingInbox.length);
  if (approvedCount) approvedCount.textContent = String(approvedPool.length);

  // 渲染待審題庫
  const inboxList = document.getElementById('inbox-list');
  if (inboxList) {
    if (pendingInbox.length === 0) {
      const emptyP = document.createElement('p');
      emptyP.style.cssText = 'color:#94a3b8; font-size:0.9rem; padding:0.5rem 0;';
      emptyP.textContent = t('empty_pending');
      inboxList.replaceChildren(emptyP);
    } else {
      const frag = document.createDocumentFragment();
      for (const item of pendingInbox) {
        const row = document.createElement('div');
        row.className = 'card';
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;';

        const txt = document.createElement('span');
        txt.style.wordBreak = 'break-word';
        txt.textContent = item.text;

        const acts = document.createElement('div');
        acts.style.display = 'flex';
        acts.style.gap = '0.5rem';

        const approveBtn = document.createElement('button');
        approveBtn.className = 'btn btn-primary';
        approveBtn.textContent = t('btn_approve');
        approveBtn.onclick = () => approveQuestion(item.tempId, item.text);

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'btn';
        rejectBtn.textContent = t('btn_reject');
        rejectBtn.onclick = () => rejectQuestion(item.tempId);

        acts.appendChild(approveBtn);
        acts.appendChild(rejectBtn);
        row.appendChild(txt);
        row.appendChild(acts);
        frag.appendChild(row);
      }
      inboxList.replaceChildren(frag);
    }
  }

  // 渲染已核准與焦點推題清單
  const approvedList = document.getElementById('approved-list');
  if (approvedList) {
    if (approvedPool.length === 0) {
      const emptyP = document.createElement('p');
      emptyP.style.cssText = 'color:#94a3b8; font-size:0.9rem; padding:0.5rem 0;';
      emptyP.textContent = t('empty_approved');
      approvedList.replaceChildren(emptyP);
    } else {
      const frag = document.createDocumentFragment();
      for (const q of approvedPool) {
        const isSpotlighted = currentSpotlight && currentSpotlight.qid === q.qid;

        const row = document.createElement('div');
        row.className = 'card';
        row.style.cssText = `display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; border-left:4px solid ${isSpotlighted ? '#3b82f6' : 'transparent'};`;

        const left = document.createElement('div');
        left.style.cssText = 'display:flex; flex-direction:column; gap:0.25rem;';

        const txt = document.createElement('span');
        txt.style.wordBreak = 'break-word';
        txt.textContent = q.text;

        const upvotes = document.createElement('span');
        upvotes.style.cssText = 'font-size:0.8rem; color:#2563eb; font-weight:600;';
        upvotes.textContent = `▲ ${q.upvotes || 0} ${t('upvote_unit')}`;

        left.appendChild(txt);
        left.appendChild(upvotes);

        const acts = document.createElement('div');
        acts.style.display = 'flex';
        acts.style.gap = '0.5rem';

        const spotBtn = document.createElement('button');
        spotBtn.className = isSpotlighted ? 'btn btn-primary' : 'btn';
        spotBtn.textContent = isSpotlighted ? t('btn_cancel_spotlight') : t('btn_spotlight');
        spotBtn.onclick = () => broadcastSpotlight(isSpotlighted ? null : q);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn';
        delBtn.style.color = '#ef4444';
        delBtn.textContent = t('btn_delete');
        delBtn.onclick = () => removeQuestion(q.qid);

        acts.appendChild(spotBtn);
        acts.appendChild(delBtn);
        row.appendChild(left);
        row.appendChild(acts);
        frag.appendChild(row);
      }
      approvedList.replaceChildren(frag);
    }
  }
}

// 初始觸發首次渲染
renderHostView();

// 11. 生命週期清理
window.addEventListener('beforeunload', () => {
  window.removeEventListener('languagechange', onLangChange);
  if (poolBroadcastTimer) clearTimeout(poolBroadcastTimer);
  if (reqSyncDebounceTimer) clearTimeout(reqSyncDebounceTimer);
  unsubStatus();
  unsubMessage();
  relay?.disconnect();
});
