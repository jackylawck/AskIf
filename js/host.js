import { Relay } from './relay.js';

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || '888888';
document.getElementById('room-id-label').textContent = roomId;
document.getElementById('open-display-btn').href = `./display.html?room=${encodeURIComponent(roomId)}`;

// 產生主持人側加入 QR
const audienceUrl = new URL(`./audience.html?room=${encodeURIComponent(roomId)}`, window.location.href).href;
if (typeof qrcode === 'function') {
  const qr = qrcode(0, 'M');
  qr.addData(audienceUrl);
  qr.make();
  const hostQrBox = document.getElementById('host-qr');
  hostQrBox.replaceChildren();
  const img = document.createElement('img');
  img.src = qr.createDataURL(3, 6);
  img.alt = 'QR Code';
  hostQrBox.appendChild(img);
}

const relay = new Relay(roomId, 'HOST');

// 權威狀態樹
const state = {
  version: 0,
  pending: new Map(),
  approved: new Map(),
  spotlight: null
};

// P0: 恢復 sessionStorage 狀態
const STORAGE_KEY = `askif_host_state_${roomId}`;
const savedState = sessionStorage.getItem(STORAGE_KEY);
if (savedState) {
  try {
    const parsed = JSON.parse(savedState);
    state.version = parsed.version || 0;
    state.pending = new Map(parsed.pending || []);
    state.spotlight = parsed.spotlight || null;
    if (Array.isArray(parsed.approved)) {
      state.approved = new Map(
        parsed.approved.map(([qid, q]) => [
          qid,
          { ...q, upvotedCids: new Set(q.upvotedCids || []) }
        ])
      );
    }
  } catch (err) {
    console.warn('[Host State Recovery Error]:', err);
  }
}

// P2 優化 1: submitRateLimit 持久化，防止刷新後可立即重刷
const LIMITS_STORAGE_KEY = `askif_host_limits_${roomId}`;
const savedLimits = sessionStorage.getItem(LIMITS_STORAGE_KEY);
const submitRateLimit = savedLimits ? new Map(JSON.parse(savedLimits)) : new Map();

const MAX_PENDING = 100;
let lastBroadcastHash = '';
let pendingSyncTimer = null;

relay.onMessage((msg) => {
  if (msg.type === 'STATUS') {
    const badge = document.getElementById('sync-badge');
    if (msg.status === 'ONLINE') {
      badge.textContent = '● 已同步雲端中繼';
      badge.style.color = '#00b894';
      broadcastState(true);
    } else {
      badge.textContent = '○ 斷線重試中...';
      badge.style.color = '#ff7675';
    }
    return;
  }

  switch (msg.type) {
    case 'SUBMIT': {
      const cid = msg.cid || 'unknown';
      const now = Date.now();
      const lastSubmit = submitRateLimit.get(cid) || 0;

      if (now - lastSubmit < 30000) return;
      if (state.pending.size >= MAX_PENDING) return;

      submitRateLimit.set(cid, now);
      sessionStorage.setItem(LIMITS_STORAGE_KEY, JSON.stringify([...submitRateLimit]));

      const qid = `q_${now}_${Math.random().toString(36).slice(2, 6)}`;
      state.pending.set(qid, {
        qid,
        text: String(msg.text || '').trim().substring(0, 150),
        cid,
        upvotes: 1,
        createdAt: now
      });
      render();
      saveToSession();
      break;
    }

    case 'UPVOTE': {
      const q = state.approved.get(msg.qid);
      const cid = msg.cid || 'unknown';
      if (q) {
        if (!q.upvotedCids) q.upvotedCids = new Set();
        if (q.upvotedCids.has(cid)) return;

        q.upvotedCids.add(cid);
        q.upvotes++;

        if (state.spotlight && state.spotlight.qid === msg.qid) {
          state.spotlight.upvotes = q.upvotes;
        }
        render();
        broadcastState();
      }
      break;
    }

    case 'REQ_SYNC': {
      // P2 優化 2: 100ms 防抖合併多人同時進場的同步請求
      if (!pendingSyncTimer) {
        pendingSyncTimer = setTimeout(() => {
          pendingSyncTimer = null;
          broadcastState(true);
        }, 100);
      }
      break;
    }
  }
});

function saveToSession() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: state.version,
      pending: Array.from(state.pending.entries()),
      approved: Array.from(state.approved.entries()).map(([k, v]) => [
        k,
        { ...v, upvotedCids: Array.from(v.upvotedCids || []) }
      ]),
      spotlight: state.spotlight
    }));
  } catch (e) {
    console.warn('[SessionStorage Quota Exceeded]:', e);
  }
}

// P2 優化 3: 廣播內容 Hash 去重，無實質狀態變動不增加 version
function broadcastState(force = false) {
  const currentHash = JSON.stringify({
    q: Array.from(state.approved.values()).map(x => [x.qid, x.upvotes]),
    s: state.spotlight
  });

  if (!force && currentHash === lastBroadcastHash) return;
  lastBroadcastHash = currentHash;

  state.version++;
  saveToSession();

  relay.send({
    type: 'STATE',
    version: state.version,
    questions: Array.from(state.approved.values()).sort((a, b) => b.upvotes - a.upvotes),
    pendingCount: state.pending.size,
    spotlight: state.spotlight
  });
}

function render() {
  document.getElementById('inbox-count').textContent = state.pending.size;
  document.getElementById('approved-count').textContent = state.approved.size;

  // 1. 待審隊列 (純 DOM API)
  const inboxEl = document.getElementById('inbox-list');
  inboxEl.replaceChildren();

  state.pending.forEach((q) => {
    const card = document.createElement('div');
    card.className = 'card';

    const textEl = document.createElement('div');
    textEl.style.cssText = 'font-size:1.05rem; font-weight:600; margin-bottom:0.5rem; word-break:break-word;';
    textEl.textContent = q.text;

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '0.5rem';

    const passBtn = document.createElement('button');
    passBtn.className = 'btn btn-success';
    passBtn.style.cssText = 'padding:0.4rem 0.8rem; font-size:0.8rem;';
    passBtn.textContent = '✅ 通過';
    passBtn.onclick = () => {
      state.pending.delete(q.qid);
      state.approved.set(q.qid, { ...q, upvotedCids: new Set([q.cid]) });
      render();
      broadcastState();
    };

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn btn-danger';
    rejectBtn.style.cssText = 'padding:0.4rem 0.8rem; font-size:0.8rem;';
    rejectBtn.textContent = '❌ 駁回';
    rejectBtn.onclick = () => {
      state.pending.delete(q.qid);
      render();
      saveToSession();
    };

    btnGroup.appendChild(passBtn);
    btnGroup.appendChild(rejectBtn);
    card.appendChild(textEl);
    card.appendChild(btnGroup);
    inboxEl.appendChild(card);
  });

  // 2. 候選池渲染（0.8s 視覺進度條長按）
  const approvedEl = document.getElementById('approved-list');
  approvedEl.replaceChildren();
  const sorted = Array.from(state.approved.values()).sort((a, b) => b.upvotes - a.upvotes);

  sorted.forEach((q) => {
    const isSpot = state.spotlight?.qid === q.qid;
    const card = document.createElement('div');
    card.className = 'card';
    card.style.border = isSpot ? '2px solid #ff4757' : '1px solid #282c35';

    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex; justify-content:space-between; margin-bottom:0.4rem;';

    const upvoteSpan = document.createElement('span');
    upvoteSpan.style.cssText = 'font-weight:700; color:#4a9eff;';
    upvoteSpan.textContent = `▲ +${q.upvotes} 附議`;
    headerRow.appendChild(upvoteSpan);

    if (isSpot) {
      const spotBadge = document.createElement('span');
      spotBadge.className = 'badge';
      spotBadge.style.cssText = 'background:#ff4757; color:#fff;';
      spotBadge.textContent = '大螢幕播放中';
      headerRow.appendChild(spotBadge);
    }
    card.appendChild(headerRow);

    const contentEl = document.createElement('div');
    contentEl.style.cssText = 'font-size:1.1rem; font-weight:600; margin-bottom:0.75rem; word-break:break-word;';
    contentEl.textContent = q.text;
    card.appendChild(contentEl);

    const actionGrid = document.createElement('div');
    actionGrid.style.cssText = 'display:grid; grid-template-columns: 2fr 1fr; gap:0.5rem;';

    const pushBtn = document.createElement('button');
    pushBtn.className = `btn ${isSpot ? 'btn-danger' : 'btn-primary'}`;
    pushBtn.style.position = 'relative';
    pushBtn.style.overflow = 'hidden';

    const labelSpan = document.createElement('span');
    labelSpan.style.position = 'relative';
    labelSpan.style.zIndex = '2';
    labelSpan.textContent = isSpot ? '⏹️ 長按撤下大螢幕' : '🚀 長按推上大螢幕';

    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      position: absolute; left: 0; top: 0; bottom: 0; width: 0%;
      background: rgba(255, 255, 255, 0.35); z-index: 1; pointer-events: none;
    `;

    pushBtn.appendChild(labelSpan);
    pushBtn.appendChild(progressBar);

    let pressTimer = null;
    const startPress = (e) => {
      e.preventDefault();
      progressBar.style.transition = 'width 0.8s linear';
      progressBar.style.width = '100%';

      pressTimer = setTimeout(() => {
        if (state.spotlight?.qid === q.qid) {
          state.spotlight = null;
        } else {
          state.spotlight = { qid: q.qid, text: q.text, upvotes: q.upvotes };
        }
        render();
        broadcastState();
      }, 800);
    };

    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      progressBar.style.transition = 'none';
      progressBar.style.width = '0%';
    };

    pushBtn.addEventListener('pointerdown', startPress);
    pushBtn.addEventListener('pointerup', cancelPress);
    pushBtn.addEventListener('pointerleave', cancelPress);
    pushBtn.addEventListener('pointercancel', cancelPress);

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn';
    dismissBtn.style.fontSize = '0.8rem';
    dismissBtn.textContent = '🗣️ 口頭答完';
    dismissBtn.onclick = () => {
      state.approved.delete(q.qid);
      if (state.spotlight?.qid === q.qid) state.spotlight = null;
      render();
      broadcastState();
    };

    actionGrid.appendChild(pushBtn);
    actionGrid.appendChild(dismissBtn);
    card.appendChild(actionGrid);
    approvedEl.appendChild(card);
  });
}

render();
