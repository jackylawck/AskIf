// js/audience.js
import { Relay } from './relay.js';
import { t } from './i18n.js';

// 1. 票據與房號檢驗
const urlParams = new URLSearchParams(window.location.search);
const roomTicket = urlParams.get('room');

if (!roomTicket) {
  showToast(t('toast_missing_ticket'), 'error');
  setTimeout(() => { window.location.href = './index.html'; }, 1500);
  throw new Error('[Audience] Missing room ticket');
}

const parts = roomTicket.split('.');
if (parts.length !== 3 || !/^\d{6}$/.test(parts[0])) {
  showToast(t('toast_missing_ticket'), 'error');
  throw new Error('[Audience] Invalid ticket structure');
}
const roomId = parts[0];
const voteStorageKey = `askif_votes_${roomId}`;

const roomIdText = document.getElementById('room-id-text');
if (roomIdText) roomIdText.textContent = roomId;

// 2. 密碼學安全 Client ID
function getOrCreateClientId() {
  let cid = sessionStorage.getItem('askif_cid');
  if (!cid) {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    cid = 'c_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('askif_cid', cid);
  }
  return cid;
}

const clientId = getOrCreateClientId();

// 3. 本地持久化投票狀態
let myUpvotes = new Set();
try {
  const saved = JSON.parse(sessionStorage.getItem(voteStorageKey) || '[]');
  myUpvotes = new Set(saved);
} catch {
  myUpvotes = new Set();
}

let lastPoolVersion = -1;
let lastSpotlightVersion = -1;
let currentQuestionsCache = [];
let currentSpotlightCache = null;

// 4. 連線實例化
const relay = new Relay(roomTicket, 'audience');

// 5. 狀態監聽與多語言同步
let currentConnectionStatus = 'CONNECTING';

function updateStatusBadge(status) {
  currentConnectionStatus = status;
  const dot = document.getElementById('status-dot');
  if (!dot) return;

  switch (status) {
    case 'ONLINE':
      dot.className = 'badge badge-online';
      dot.textContent = t('status_connected');
      break;
    case 'CONNECTING':
      dot.className = 'badge badge-peer';
      dot.textContent = t('status_connecting');
      break;
    case 'OFFLINE':
      dot.className = 'badge badge-danger';
      dot.textContent = t('status_reconnecting');
      break;
    case 'FAILED':
      dot.className = 'badge badge-danger';
      dot.textContent = t('status_failed');
      showToast(t('toast_net_err'), 'error');
      break;
    case 'CLOSED':
      dot.className = 'badge badge-danger';
      dot.textContent = t('status_closed');
      break;
  }
}

const unsubStatus = relay.onStatus((event) => {
  updateStatusBadge(event.status);
  if (event.status === 'ONLINE') {
    relay.send({ type: 'REQ_SYNC', cid: clientId });
  }
});

// 語言切換即時重繪
const onLangChange = () => {
  updateStatusBadge(currentConnectionStatus);
  if (currentQuestionsCache.length > 0) {
    renderQuestionList(currentQuestionsCache);
  }
  if (currentSpotlightCache) {
    renderSpotlight(currentSpotlightCache);
  }
};
window.addEventListener('languagechange', onLangChange);

// 6. 業務監聽
const unsubMessage = relay.onMessage((msg) => {
  switch (msg.type) {
    case 'SYNC_POOL': {
      if (typeof msg.version === 'number') {
        if (msg.version <= lastPoolVersion) return;
        lastPoolVersion = msg.version;
      }
      if (Array.isArray(msg.questions)) {
        currentQuestionsCache = msg.questions;
        renderQuestionList(msg.questions);
      }
      break;
    }

    case 'SPOTLIGHT': {
      if (typeof msg.version === 'number') {
        if (msg.version <= lastSpotlightVersion) return;
        lastSpotlightVersion = msg.version;
      }
      currentSpotlightCache = msg.question;
      renderSpotlight(msg.question);
      break;
    }
  }
});

// 7. 渲染題庫
function renderQuestionList(questions) {
  const container = document.getElementById('question-list');
  if (!container) return;

  const sorted = [...questions].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
  const fragment = document.createDocumentFragment();

  for (const q of sorted) {
    const qid = q.qid;
    if (!qid) continue;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = `q-${qid}`;
    card.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;';

    const textEl = document.createElement('div');
    textEl.style.cssText = 'word-break:break-word; flex:1; margin-right:1rem;';
    textEl.textContent = q.text || '';

    const metaEl = document.createElement('div');
    metaEl.style.cssText = 'display:flex; align-items:center; gap:0.5rem; flex-shrink:0;';

    const countEl = document.createElement('span');
    countEl.id = `count-${qid}`;
    countEl.style.cssText = 'font-weight:600; color:#2563eb; font-size:0.9rem;';
    countEl.textContent = `▲ ${q.upvotes || 0}`;

    const upvoteBtn = document.createElement('button');
    const hasVoted = myUpvotes.has(qid);
    upvoteBtn.className = hasVoted ? 'btn' : 'btn btn-primary';
    upvoteBtn.id = `up-${qid}`;
    upvoteBtn.disabled = hasVoted;
    upvoteBtn.textContent = hasVoted ? t('btn_voted') : t('btn_upvote');

    if (!hasVoted) {
      upvoteBtn.onclick = () => handleUpvote(qid);
    }

    metaEl.appendChild(countEl);
    metaEl.appendChild(upvoteBtn);
    card.appendChild(textEl);
    card.appendChild(metaEl);
    fragment.appendChild(card);
  }

  container.replaceChildren(fragment);
}

// 8. 附議處理（樂觀更新 + 失敗回滾）
function handleUpvote(qid) {
  if (myUpvotes.has(qid)) return;

  const btn = document.getElementById(`up-${qid}`);
  const countEl = document.getElementById(`count-${qid}`);

  myUpvotes.add(qid);
  if (btn) {
    btn.disabled = true;
    btn.className = 'btn';
    btn.textContent = t('btn_voted');
  }
  let prevCount = 0;
  if (countEl) {
    prevCount = parseInt(countEl.textContent.replace(/[^\d]/g, ''), 10) || 0;
    countEl.textContent = `▲ ${prevCount + 1}`;
  }

  const success = relay.send({
    type: 'UPVOTE',
    qid,
    cid: clientId
  });

  if (success) {
    sessionStorage.setItem(voteStorageKey, JSON.stringify([...myUpvotes]));
  } else {
    myUpvotes.delete(qid);
    if (btn) {
      btn.disabled = false;
      btn.className = 'btn btn-primary';
      btn.textContent = t('btn_upvote');
    }
    if (countEl) {
      countEl.textContent = `▲ ${prevCount}`;
    }
    showToast(t('toast_net_err'), 'error');
  }
}

// 9. 提問送出控制
const askForm = document.getElementById('ask-form');
const askInput = document.getElementById('ask-input');
const charCount = document.getElementById('char-count');
const submitBtn = document.getElementById('submit-btn');

if (askInput && charCount) {
  askInput.oninput = () => {
    charCount.textContent = `${askInput.value.length}/150`;
  };
}

if (askForm && askInput) {
  askForm.onsubmit = (e) => {
    e.preventDefault();
    const text = askInput.value.trim();
    if (!text) return;

    if (text.length > 150) {
      showToast(t('toast_limit_150'), 'error');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    const success = relay.send({
      type: 'SUBMIT_QUESTION',
      text,
      cid: clientId,
      timestamp: Date.now()
    });

    if (success) {
      askInput.value = '';
      if (charCount) charCount.textContent = '0/150';
      showToast(t('toast_submitted'), 'success');
      setTimeout(() => { if (submitBtn) submitBtn.disabled = false; }, 1000);
    } else {
      showToast(t('toast_net_err'), 'error');
      if (submitBtn) submitBtn.disabled = false;
    }
  };
}

// 10. 焦點題目渲染
function renderSpotlight(question) {
  const box = document.getElementById('spotlight-box');
  if (!box) return;

  if (!question || !question.text) {
    box.style.display = 'none';
    box.textContent = '';
    return;
  }

  box.style.display = 'block';
  box.replaceChildren();

  const badge = document.createElement('span');
  badge.style.cssText = 'color:#94a3b8; font-size:0.85rem; font-weight:600; display:block; margin-bottom:0.25rem;';
  badge.textContent = t('spotlight_prefix');

  const textNode = document.createElement('div');
  textNode.style.cssText = 'font-size:1.1rem; font-weight:700;';
  textNode.textContent = question.text;

  box.appendChild(badge);
  box.appendChild(textNode);
}

// 11. 輕量非阻塞 Toast
function showToast(msg, type = 'info') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      padding: 10px 18px; border-radius: 8px; color: #fff; font-size: 14px;
      z-index: 9999; transition: opacity 0.3s ease; pointer-events: none;
    `;
    document.body.appendChild(toast);
  }

  toast.style.background = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
  toast.textContent = msg;
  toast.style.opacity = '1';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 2500);
}

// 12. 卸載清理
window.addEventListener('beforeunload', () => {
  window.removeEventListener('languagechange', onLangChange);
  unsubStatus?.();
  unsubMessage?.();
  relay?.disconnect();
});
