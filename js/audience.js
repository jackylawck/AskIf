// js/audience.js
import { Relay } from './relay.js';

// 1. 票據與房號檢驗（杜絕多餘 fallback）
const urlParams = new URLSearchParams(window.location.search);
const roomTicket = urlParams.get('room');

if (!roomTicket) {
  showToast('缺少房號票據，請重新掃描現場 QR Code！', 'error');
  setTimeout(() => { window.location.href = './index.html'; }, 1500);
  throw new Error('[Audience] Missing room ticket');
}

const parts = roomTicket.split('.');
if (parts.length !== 3 || !/^\d{6}$/.test(parts[0])) {
  showToast('票據格式錯誤，請重新掃描！', 'error');
  throw new Error('[Audience] Invalid ticket structure');
}
const roomId = parts[0];
const voteStorageKey = `askif_votes_${roomId}`;

// 2. 密碼學安全 Client ID（杜絕 Math.random 降級）
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

// 3. 投票持久化
let myUpvotes = new Set();
try {
  const saved = JSON.parse(sessionStorage.getItem(voteStorageKey) || '[]');
  myUpvotes = new Set(saved);
} catch {
  myUpvotes = new Set();
}

let lastPoolVersion = -1;
let lastSpotlightVersion = -1;

// 4. 連線實例化
const relay = new Relay(roomTicket, 'audience');

// 5. 狀態監聽
const unsubStatus = relay.onStatus((event) => {
  const dot = document.getElementById('status-dot');
  if (!dot) return;

  switch (event.status) {
    case 'ONLINE':
      dot.className = 'badge badge-online';
      dot.textContent = '● 在線';
      relay.send({ type: 'REQ_SYNC', cid: clientId });
      break;
    case 'CONNECTING':
      dot.className = 'badge badge-peer';
      dot.textContent = '◌ 連線中';
      break;
    case 'OFFLINE':
      dot.className = 'badge badge-danger';
      dot.textContent = '○ 斷線重試中';
      break;
    case 'FAILED':
      dot.className = 'badge badge-danger';
      dot.textContent = '✕ 連線失敗';
      showToast('與伺服器中斷連線，請檢查現場網路', 'error');
      break;
    case 'CLOSED':
      dot.className = 'badge badge-danger';
      dot.textContent = '○ 活動已結束';
      break;
  }
});

// 6. 業務監聽（含 Spotlight 版本防亂序）
const unsubMessage = relay.onMessage((msg) => {
  switch (msg.type) {
    case 'SYNC_POOL': {
      if (typeof msg.version === 'number') {
        if (msg.version <= lastPoolVersion) return;
        lastPoolVersion = msg.version;
      }
      if (Array.isArray(msg.questions)) {
        renderQuestionList(msg.questions);
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

// 7. 渲染題庫（統一 qid）
function renderQuestionList(questions) {
  const container = document.getElementById('question-list');
  if (!container) return;

  const sorted = [...questions].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
  const fragment = document.createDocumentFragment();

  for (const q of sorted) {
    const qid = q.qid;
    if (!qid) continue;

    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `q-${qid}`;

    const textEl = document.createElement('div');
    textEl.className = 'question-text';
    textEl.textContent = q.text || '';

    const metaEl = document.createElement('div');
    metaEl.className = 'question-meta';

    const countEl = document.createElement('span');
    countEl.className = 'upvote-count';
    countEl.id = `count-${qid}`;
    countEl.textContent = `▲ ${q.upvotes || 0}`;

    const upvoteBtn = document.createElement('button');
    upvoteBtn.className = 'btn-upvote';
    upvoteBtn.id = `up-${qid}`;

    const hasVoted = myUpvotes.has(qid);
    upvoteBtn.disabled = hasVoted;
    upvoteBtn.textContent = hasVoted ? '已附議' : '附議';

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

// 8. 附議送出（樂觀數值跳動 + 回滾防護）
function handleUpvote(qid) {
  if (myUpvotes.has(qid)) return;

  const btn = document.getElementById(`up-${qid}`);
  const countEl = document.getElementById(`count-${qid}`);

  // 樂觀更新：狀態鎖定 + 數字即時跳動
  myUpvotes.add(qid);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '已附議';
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
    // 網路不可用，雙重回滾
    myUpvotes.delete(qid);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '附議';
    }
    if (countEl) {
      countEl.textContent = `▲ ${prevCount}`;
    }
    showToast('網路發送失敗，請稍後重試', 'error');
  }
}

// 9. 提問表單（嚴格對齊 PROTOCOL v1.1.0：觀眾不帶 qid）
const askForm = document.getElementById('ask-form');
const askInput = document.getElementById('ask-input');
const charCount = document.getElementById('char-count');
const submitBtn = askForm ? askForm.querySelector('button[type="submit"]') : null;

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
      showToast('提問文字上限為 150 字', 'error');
      return;
    }

    // 防連點防護
    if (submitBtn) submitBtn.disabled = true;

    // 依協議只送出 text, cid, timestamp
    const success = relay.send({
      type: 'SUBMIT_QUESTION',
      text,
      cid: clientId,
      timestamp: Date.now()
    });

    if (success) {
      askInput.value = '';
      if (charCount) charCount.textContent = '0/150';
      showToast('問題已送出，等待審核！', 'success');
      setTimeout(() => { if (submitBtn) submitBtn.disabled = false; }, 1000);
    } else {
      showToast('發送失敗，網路連線異常', 'error');
      if (submitBtn) submitBtn.disabled = false;
    }
  };
}

// 10. 焦點推題渲染（支援 null 取消焦點語意）
function renderSpotlight(question) {
  const box = document.getElementById('spotlight-box');
  if (!box) return;

  if (!question || !question.text) {
    box.style.display = 'none';
    box.textContent = '';
    return;
  }

  box.style.display = 'block';
  box.textContent = `【目前討論】 ${question.text}`;
}

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

window.addEventListener('beforeunload', () => {
  unsubStatus();
  unsubMessage();
  relay?.disconnect();
});
