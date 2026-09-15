// js/host.js
import { Relay } from './relay.js';

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

function updateBadge(statusText, className) {
  const badge = document.getElementById('sync-badge');
  if (badge) {
    badge.textContent = statusText;
    badge.className = `badge ${className}`;
  }
}

// 2. 主持人授權
let hostPassword = sessionStorage.getItem('askif_pwd');
if (!hostPassword) {
  hostPassword = prompt(window.t ? window.t('input_pwd_prompt') || '請輸入主持人管理密碼：' : '請輸入主持人管理密碼：');
  if (!hostPassword) {
    alert('必須輸入密碼才能管理房間！');
    window.location.href = './index.html';
    throw new Error('[Host] Authentication cancelled.');
  }
  sessionStorage.setItem('askif_pwd', hostPassword);
}

// 3. 狀態復原與本地持久化（防重整歸零）
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
let currentSpotlight = null;
let upvoteRecord = new Set();

try {
  approvedPool = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.POOL) || '[]');
  currentSpotlight = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.SPOTLIGHT) || 'null');
  upvoteRecord = new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEYS.UPVOTES) || '[]'));
} catch (e) {
  console.warn('[Host] Failed to hydrate state from sessionStorage', e);
}

// 活性 GC：定期清理已移出題庫的過期附議鍵，防記憶體與 Storage 膨脹
function pruneUpvoteRecord() {
  const activeQids = new Set(approvedPool.map(q => q.qid));
  let pruned = false;
  for (const recordKey of upvoteRecord) {
    const qid = recordKey.split(':')[0];
    if (!activeQids.has(qid)) {
      upvoteRecord.delete(recordKey);
      pruned = true;
    }
  }
  return pruned;
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

// 4. 廣播引擎與防驚群節流控制器
let poolBroadcastTimer = null;
let reqSyncDebounceTimer = null;

// 立即廣播基線狀態（由重大操作如核准新題主動呼叫）
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

// 附議風暴 500ms 合併節流
function scheduleSyncPoolBroadcast() {
  if (poolBroadcastTimer) return;
  poolBroadcastTimer = setTimeout(() => {
    poolBroadcastTimer = null;
    broadcastSyncPoolImmediate();
  }, 500);
}

// 防驚群核心：將 300ms 內湧入的大量 REQ_SYNC 請求聚合為單一廣播
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
}

// 5. 實例化統一通訊客戶端
const relay = new Relay(roomTicket, 'host', hostPassword);

// 6. 狀態監聽
const unsubStatus = relay.onStatus((event) => {
  switch (event.status) {
    case 'CONNECTING':
    case 'AUTHENTICATING':
      updateBadge('連線中...', 'badge-peer');
      break;
    case 'ONLINE':
      updateBadge('● 已同步雲端中繼', 'badge-online');
      // 主持人連線/重連上線時，透過防抖發布基線狀態，避免網路抖動重連時頻繁廣播
      scheduleReqSyncResponse();
      break;
    case 'OFFLINE':
      updateBadge('○ 斷線重試中...', 'badge-offline');
      break;
    case 'CLOSED':
      updateBadge('連線已關閉', 'badge-offline');
      break;
    case 'AUTH_FAILED':
      sessionStorage.removeItem('askif_pwd');
      updateBadge('密碼錯誤', 'badge-offline');
      alert('密碼錯誤！請重新整理後輸入正確密碼。');
      relay.disconnect();
      window.location.reload();
      break;
    case 'FAILED':
      alert('與中繼伺服器中斷連線，請檢查現場網路。');
      break;
  }
});

// 7. 業務訊息監聽（全閉環 + 防抖聚合）
const unsubMessage = relay.onMessage((msg) => {
  switch (msg.type) {
    // 聚合防驚群：面對高併發同步請求，300ms 窗口內僅回應一次廣播
    case 'REQ_SYNC': {
      scheduleReqSyncResponse();
      break;
    }

    case 'SUBMIT_QUESTION': {
      if (typeof handleNewQuestionProposal === 'function') {
        handleNewQuestionProposal(msg);
      }
      break;
    }

    case 'UPVOTE': {
      const { qid, cid } = msg;
      if (!qid || !cid) return;

      const dedupeKey = `${qid}:${cid}`;
      if (upvoteRecord.has(dedupeKey)) return; // 冪等去重

      const target = approvedPool.find(q => q.qid === qid);
      if (target) {
        upvoteRecord.add(dedupeKey);
        target.upvotes = (target.upvotes || 0) + 1;
        persistState();
        scheduleSyncPoolBroadcast(); // 觸發 500ms 節流廣播
        if (typeof renderHostView === 'function') renderHostView();
      }
      break;
    }
  }
});

// 8. 審核通過並簽發權威唯一 qid
export function approveQuestion(text) {
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  const randomHex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  const qid = `q_${Date.now()}_${randomHex}`;

  approvedPool.push({ qid, text, upvotes: 0 });
  persistState();
  broadcastSyncPoolImmediate();
  if (typeof renderHostView === 'function') renderHostView();
}

// 移除題目並觸發垃圾回收
export function removeQuestion(qid) {
  approvedPool = approvedPool.filter(q => q.qid !== qid);
  pruneUpvoteRecord();
  persistState();
  broadcastSyncPoolImmediate();
  if (typeof renderHostView === 'function') renderHostView();
}

// 9. 生命週期清理
window.addEventListener('beforeunload', () => {
  if (poolBroadcastTimer) clearTimeout(poolBroadcastTimer);
  if (reqSyncDebounceTimer) clearTimeout(reqSyncDebounceTimer);
  unsubStatus();
  unsubMessage();
  relay?.disconnect();
});
