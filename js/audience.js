import { Relay } from './relay.js';
import { getSavedLang, TRANSLATIONS, applyI18n } from './i18n.js';

// 初始化並套用雙語
let currentLang = getSavedLang();
applyI18n(currentLang);

function getDict() {
  return TRANSLATIONS[getSavedLang()] || TRANSLATIONS.zh;
}

const urlParams = new URLSearchParams(window.location.search);
const rawRoom = urlParams.get('room') || '888888';
// 確保只取 6 位純數字房號
const roomId = rawRoom.includes('.') ? rawRoom.split('.')[0] : rawRoom;

const roomTagEl = document.getElementById('room-id-tag');
if (roomTagEl) {
  roomTagEl.textContent = `${getDict().room || '房號'}: ${roomId}`;
}

const relay = new Relay(roomId, 'AUDIENCE');
const myUpvotes = new Set(JSON.parse(sessionStorage.getItem(`askif_votes_${roomId}`) || '[]'));
let lastVersion = 0;

relay.onMessage((msg) => {
  if (msg.type === 'STATUS') {
    const dot = document.getElementById('status-dot');
    if (dot) {
      dot.className = msg.status === 'ONLINE' ? 'badge badge-online' : 'badge badge-danger';
      dot.textContent = msg.status === 'ONLINE' 
        ? `● ${getDict().connected || '已連線'}` 
        : `○ ${getDict().disconnected || '斷線'}`;
    }
    if (msg.status === 'ONLINE') {
      relay.send({ type: 'REQ_SYNC' });
    }
    return;
  }

  if (msg.type === 'STATE') {
    if (msg.version <= lastVersion) return;
    lastVersion = msg.version;
    renderQuestions(msg.questions || []);
  }
});

const qInput = document.getElementById('question-input');
const charCount = document.getElementById('char-count');
if (qInput && charCount) {
  qInput.addEventListener('input', () => {
    charCount.textContent = `${qInput.value.length}/200`;
  });
}

window.submitQuestion = () => {
  if (!qInput) return;
  const text = qInput.value.trim();
  const dict = getDict();
  if (!text) {
    showToast(dict.emptyMsg || '請輸入問題內容！');
    return;
  }

  relay.send({
    type: 'SUBMIT',
    text,
    cid: getOrCreateClientId()
  });

  qInput.value = '';
  if (charCount) charCount.textContent = '0/200';
  showToast(dict.successMsg || '提問已送達後台審核隊列！');
};

window.upvote = (qid) => {
  const dict = getDict();
  if (myUpvotes.has(qid)) return;
  myUpvotes.add(qid);
  sessionStorage.setItem(`askif_votes_${roomId}`, JSON.stringify([...myUpvotes]));

  relay.send({
    type: 'UPVOTE',
    qid,
    cid: getOrCreateClientId()
  });

  const btn = document.getElementById(`up-${qid}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = dict.upvoted || '已附議';
    btn.style.opacity = '0.6';
  }
};

function renderQuestions(list) {
  const pool = document.getElementById('questions-pool');
  if (!pool) return;
  pool.replaceChildren();
  const dict = getDict();

  if (list.length === 0) {
    const emptyP = document.createElement('p');
    emptyP.style.cssText = 'text-align:center; padding:2rem 0; color:#b0b6bd;';
    emptyP.textContent = currentLang === 'zh' ? '目前尚無過審題目，搶先發問吧！' : 'No approved questions yet. Be the first to ask!';
    pool.appendChild(emptyP);
    return;
  }

  list.forEach((q) => {
    const hasVoted = myUpvotes.has(q.qid);
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:0.75rem;';

    const textSpan = document.createElement('div');
    textSpan.style.cssText = 'font-weight:600; font-size:0.95rem; flex:1; word-break:break-word;';
    textSpan.textContent = q.text;

    const btn = document.createElement('button');
    btn.id = `up-${q.qid}`;
    btn.className = 'btn';
    btn.style.cssText = 'padding:0.4rem 0.8rem; font-size:0.85rem; background:rgba(74,158,255,0.15); color:#4a9eff;';
    btn.textContent = hasVoted ? (dict.upvoted || '已附議') : `▲ ${q.upvotes}`;
    btn.disabled = hasVoted;
    if (hasVoted) btn.style.opacity = '0.6';

    btn.onclick = () => window.upvote(q.qid);

    card.appendChild(textSpan);
    card.appendChild(btn);
    pool.appendChild(card);
  });
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(100px);
      background: #4a9eff; color: #fff; padding: 10px 20px; border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4); font-size: 0.9rem; font-weight: 600;
      transition: transform 0.25s ease; z-index: 9999; pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
  }, 3000);
}

function getOrCreateClientId() {
  let cid = sessionStorage.getItem('askif_cid');
  if (!cid) {
    cid = 'c_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('askif_cid', cid);
  }
  return cid;
}
