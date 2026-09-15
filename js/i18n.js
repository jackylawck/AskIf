// js/i18n.js

const isDev = Boolean(
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname.endsWith('.internal')
);

// 1. 精確定義語言字典（採用 zh-Hant 繁體標準）
const translations = {
  'zh-Hant': {
    // 系統與狀態
    'status_connecting': '◌ 連線中...',
    'status_connected': '● 已同步雲端中繼',
    'status_reconnecting': '○ 斷線重試中...',
    'status_closed': '○ 活動已結束',
    'status_syncing': '連線中...',
    'input_pwd_prompt': '請輸入主持人管理密碼：',
    'pwd_error': '主持人密碼錯誤！請重新輸入。',
    'room_label': '房號',
    
    // 觀眾端
    'ask_placeholder': '請輸入您的問題（限 150 字）...',
    'btn_submit': '送出提問',
    'btn_upvote': '附議',
    'btn_voted': '已附議',
    'spotlight_prefix': '【目前討論】',
    'toast_submitted': '問題已送出，等待審核！',
    'toast_limit_150': '提問文字上限為 150 字',
    'toast_net_err': '網路發送失敗，請稍後重試',
    'toast_missing_ticket': '缺少房號票據，請重新掃描現場 QR Code！',
    
    // 主持人端
    'tab_audit': '待審核題目',
    'tab_approved': '已通過題庫',
    'btn_approve': '通過',
    'btn_reject': '拒絕',
    'btn_spotlight': '設為焦點',
    'btn_cancel_spotlight': '取消焦點',
    'btn_delete': '刪除',
    'empty_pending': '目前沒有待審核題目',
    'empty_approved': '目前題庫是空的',
    
    // 大螢幕
    'display_standby_title': '現場互動問答',
    'display_standby_subtitle': '請掃描 QR Code 提問或為問題附議',
    'display_leaderboard': '熱門提問榜'
  },
  'en': {
    // System & Status
    'status_connecting': '◌ Connecting...',
    'status_connected': '● Cloud Synced',
    'status_reconnecting': '○ Reconnecting...',
    'status_closed': '○ Session Closed',
    'status_syncing': 'Connecting...',
    'input_pwd_prompt': 'Enter Host Admin Password:',
    'pwd_error': 'Invalid Password! Please re-enter.',
    'room_label': 'Room',
    
    // Audience
    'ask_placeholder': 'Type your question (max 150 chars)...',
    'btn_submit': 'Submit',
    'btn_upvote': 'Upvote',
    'btn_voted': 'Upvoted',
    'spotlight_prefix': '[Now Discussing]',
    'toast_submitted': 'Question submitted, awaiting moderation!',
    'toast_limit_150': 'Question must be within 150 characters',
    'toast_net_err': 'Network error, please retry',
    'toast_missing_ticket': 'Missing room ticket. Please scan the QR Code again!',
    
    // Host
    'tab_audit': 'Pending Review',
    'tab_approved': 'Approved Pool',
    'btn_approve': 'Approve',
    'btn_reject': 'Reject',
    'btn_spotlight': 'Spotlight',
    'btn_cancel_spotlight': 'Unspotlight',
    'btn_delete': 'Delete',
    'empty_pending': 'No questions pending review',
    'empty_approved': 'Question pool is empty',
    
    // Display
    'display_standby_title': 'Live Q&A Session',
    'display_standby_subtitle': 'Scan QR Code to submit questions or upvote',
    'display_leaderboard': 'Top Questions'
  }
};

const SUPPORTED_LANGS = ['zh-Hant', 'en'];
let currentLang = localStorage.getItem('askif_lang') || 'zh-Hant';

// 舊版快取若存的是 'zh' 則自動正規化
if (currentLang === 'zh') currentLang = 'zh-Hant';
if (!SUPPORTED_LANGS.includes(currentLang)) currentLang = 'zh-Hant';

// 2. 翻譯取值函式（含雙向 Fallback 機制與 Dev 環境日誌隔離）
export function t(key) {
  const activeDict = translations[currentLang];
  if (activeDict && activeDict[key]) {
    return activeDict[key];
  }

  const fallbackLang = currentLang === 'zh-Hant' ? 'en' : 'zh-Hant';
  const fallbackDict = translations[fallbackLang];
  if (fallbackDict && fallbackDict[key]) {
    if (isDev) {
      console.warn(`[i18n] Key "${key}" missing in ${currentLang}, falling back to ${fallbackLang}`);
    }
    return fallbackDict[key];
  }

  return key;
}

// 3. 語言切換與 DOM 渲染更新
export function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;

  currentLang = lang;
  localStorage.setItem('askif_lang', lang);

  // 動態更新 <html lang="...">
  document.documentElement.lang = lang;

  // 渲染純文字節點：嚴格使用 textContent
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // 渲染 Placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.setAttribute('placeholder', t(key));
    }
  });

  // 補回：語言切換按鈕文本動態更新（顯示下一個切換目標）
  const toggleBtn = document.getElementById('lang-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = currentLang === 'zh-Hant' ? 'EN' : '中文';
  }
}

export function toggleLanguage() {
  const nextLang = currentLang === 'zh-Hant' ? 'en' : 'zh-Hant';
  setLanguage(nextLang);
}

// 4. 掛載到 window 物件相容全域與現有 HTML 標籤
window.t = t;
window.setLanguage = setLanguage;
window.toggleLanguage = toggleLanguage;

// 5. DOM 載入時機防禦：檢查 readyState
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setLanguage(currentLang));
} else {
  setLanguage(currentLang);
}
