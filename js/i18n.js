// js/i18n.js

const isDev = Boolean(
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname.endsWith('.internal')
);

const translations = {
  'zh-Hant': {
    // 系統與狀態
    'status_connecting': '◌ 連線中...',
    'status_connected': '● 已同步雲端中繼',
    'status_reconnecting': '○ 斷線重試中...',
    'status_closed': '○ 活動已結束',
    'status_failed': '✕ 連線失敗',
    'status_syncing': '連線中...',
    'input_pwd_prompt': '請輸入主持人管理密碼：',
    'pwd_error': '主持人密碼錯誤！請重新輸入。',
    'pwd_empty': '請輸入密碼',
    'room_label': '房號',
    'upvote_unit': '附議',
    
    // 首頁與通用
    'index_title': 'AskIf 現場問 — 即時問答',
    'app_name': 'AskIf 現場問',
    'app_subtitle': '無狀態中繼 · 物理級私隱 · 關閉分頁即物理銷毀',
    'host_role_title': '🎤 培訓師 / 主持人',
    'host_role_desc': '建立本地權威房間，由你這部設備直接擔任唯一真實來源。',
    'btn_create_room': '🚀 建立活動房間',
    'audience_join_title': '📱 參與者加入',
    'audience_join_desc': '請優先掃描大螢幕 QR Code；或貼上專屬受邀連結 / 完整票據：',
    'btn_join_room': '進入提問室',
    'btn_cancel': '取消',
    'btn_confirm_create': '確認開房',
    
    // 觀眾端
    'audience_page_title': 'AskIf — 現場提問',
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
    'host_page_title': 'AskIf — 主持人 Pad',
    'open_display': '🖥️ 開大螢幕',
    'qr_hint_title': '📱 觀眾現場掃碼加入',
    'qr_hint_desc': '純記憶體運作，關閉分頁即物理銷毀。',
    'inbox_title': '📥 待審題庫',
    'approved_title': '🚀 候選與大螢幕推題',
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
    'display_title': 'AskIf — 現場大螢幕',
    'display_heading': '現場提問與互動',
    'display_scan_hint': '掃描 QR Code 提交問題 / 附議',
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
    'status_failed': '✕ Connection Failed',
    'status_syncing': 'Connecting...',
    'input_pwd_prompt': 'Enter Host Admin Password:',
    'pwd_error': 'Invalid Password! Please re-enter.',
    'pwd_empty': 'Please enter password',
    'room_label': 'Room',
    'upvote_unit': 'Upvotes',
    
    // Portal & General
    'index_title': 'AskIf Live Q&A',
    'app_name': 'AskIf Live',
    'app_subtitle': 'Stateless Relay · Zero Persistence · Closed Tab Means Destroyed',
    'host_role_title': '🎤 Trainer / Host',
    'host_role_desc': 'Create an authoritative room hosted directly on this browser device.',
    'btn_create_room': '🚀 Create Live Session',
    'audience_join_title': '📱 Audience Access',
    'audience_join_desc': 'Scan the screen QR code or paste your invited ticket URL:',
    'btn_join_room': 'Join Room',
    'btn_cancel': 'Cancel',
    'btn_confirm_create': 'Confirm',
    
    // Audience
    'audience_page_title': 'AskIf — Live Q&A',
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
    'host_page_title': 'AskIf — Host Console',
    'open_display': '🖥️ Open Display',
    'qr_hint_title': '📱 Live Audience Scan Code',
    'qr_hint_desc': 'Runs fully in-memory, physically destroyed once closed.',
    'inbox_title': '📥 Review Inbox',
    'approved_title': '🚀 Approved & Spotlight Pool',
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
    'display_title': 'AskIf — Main Display',
    'display_heading': 'Live Q&A Session',
    'display_scan_hint': 'Scan QR code to submit questions or upvote',
    'display_standby_title': 'Live Q&A Session',
    'display_standby_subtitle': 'Scan QR Code to submit questions or upvote',
    'display_leaderboard': 'Top Questions'
  }
};

const SUPPORTED_LANGS = ['zh-Hant', 'en'];
let currentLang = localStorage.getItem('askif_lang') || 'zh-Hant';

if (currentLang === 'zh') currentLang = 'zh-Hant';
if (!SUPPORTED_LANGS.includes(currentLang)) currentLang = 'zh-Hant';

export function t(key) {
  const activeDict = translations[currentLang];
  if (activeDict && activeDict[key]) return activeDict[key];

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

export function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;

  currentLang = lang;
  localStorage.setItem('askif_lang', lang);
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });

  const toggleBtn = document.getElementById('lang-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = currentLang === 'zh-Hant' ? 'EN' : '中文';
  }

  // 廣播自訂事件，通知 host.js / audience.js / display.js 立即重繪動態字串
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
}

export function toggleLanguage() {
  const nextLang = currentLang === 'zh-Hant' ? 'en' : 'zh-Hant';
  setLanguage(nextLang);
}

window.t = t;
window.setLanguage = setLanguage;
window.toggleLanguage = toggleLanguage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setLanguage(currentLang));
} else {
  setLanguage(currentLang);
}
