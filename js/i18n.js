const translations = {
  zh: {
    // 共用
    room_label: "房號",
    loading: "載入中...",
    upvote_unit: "附議",
    // index.html
    index_title: "AskIf 現場問 — 零事故即時問答",
    app_name: "AskIf 現場問",
    app_subtitle: "無狀態中繼 · 物理級私隱 · 關閉分頁即物理銷毀",
    host_role_title: "🎤 培訓師 / 主持人",
    host_role_desc: "建立本地權威房間，由你這部設備直接擔任唯一真實來源。",
    btn_create_room: "🚀 建立活動房間",
    audience_join_title: "📱 參與者加入",
    audience_join_desc: "輸入主持人提供的 6 位數房號直接加入：",
    input_room_placeholder: "例如: 888888",
    btn_join_room: "進入提問室",
    alert_no_room: "請輸入房號",
    // host.html
    host_page_title: "AskIf — 主持人戰情 Pad",
    status_syncing: "連線同步中...",
    status_connected: "● 已同步雲端中繼",
    status_reconnecting: "○ 斷線重試中...",
    open_display: "🖥️ 開大螢幕",
    qr_hint_title: "📱 觀眾現場掃碼加入",
    qr_hint_desc: "純記憶體運作，關閉分頁即物理銷毀。",
    inbox_title: "📥 待審題庫",
    approved_title: "🚀 候選與大螢幕推題",
    btn_approve: "✅ 通過",
    btn_reject: "❌ 刪除",
    btn_hold_push: "長按推題 (0.8s)",
    btn_active: "🌟 播映中",
    // display.html
    display_title: "AskIf — 現場大螢幕",
    display_heading: "現場提問與互動",
    display_scan_hint: "掃描 QR Code 提交問題 / 附議",
    // audience.html
    audience_page_title: "AskIf — 現場提問",
    audience_room_title: "現場提問室",
    status_connecting: "連線中...",
    question_input_placeholder: "輸入你想探討的問題（限 150 字）...",
    btn_submit: "送出提問",
    featured_pool_title: "🔥 精選提問池",
    btn_upvote: "▲ 附議",
    toast_sent: "提問已送達後台審核隊列！",
    toast_empty: "請先輸入內容再送出。"
  },
  en: {
    // Common
    room_label: "Room",
    loading: "Loading...",
    upvote_unit: "Upvotes",
    // index.html
    index_title: "AskIf — Zero-Incident Live Q&A",
    app_name: "AskIf Live",
    app_subtitle: "Stateless Relay · Ephemeral Privacy · Purged on Tab Close",
    host_role_title: "🎤 Speaker / Moderator",
    host_role_desc: "Establish authoritative room. Your device acts as the single source of truth.",
    btn_create_room: "🚀 Create Event Room",
    audience_join_title: "📱 Join as Audience",
    audience_join_desc: "Enter the 6-digit room PIN provided by the host:",
    input_room_placeholder: "e.g. 888888",
    btn_join_room: "Enter Room",
    alert_no_room: "Please enter a room PIN",
    // host.html
    host_page_title: "AskIf — Host Control Pad",
    status_syncing: "Syncing connection...",
    status_connected: "● Cloud Relay Synced",
    status_reconnecting: "○ Reconnecting...",
    open_display: "🖥️ Open Screen",
    qr_hint_title: "📱 Scan QR Code to Join",
    qr_hint_desc: "In-memory execution, purged on tab close.",
    inbox_title: "📥 Pending Moderation",
    approved_title: "🚀 Candidate & Push to Screen",
    btn_approve: "✅ Approve",
    btn_reject: "❌ Delete",
    btn_hold_push: "Hold to Push (0.8s)",
    btn_active: "🌟 On Screen",
    // display.html
    display_title: "AskIf — Live Display",
    display_heading: "Live Q&A & Interaction",
    display_scan_hint: "Scan QR Code to submit questions & upvote",
    // audience.html
    audience_page_title: "AskIf — Audience Live Q&A",
    audience_room_title: "Live Q&A Room",
    status_connecting: "Connecting...",
    question_input_placeholder: "Type your question here (max 150 chars)...",
    btn_submit: "Submit Question",
    featured_pool_title: "🔥 Featured Questions",
    btn_upvote: "▲ Upvote",
    toast_sent: "Submitted to review queue!",
    toast_empty: "Please type something before submitting."
  }
};

let currentLang = localStorage.getItem('askif_lang') || 'zh';

window.t = function(key) {
  return (translations[currentLang] && translations[currentLang][key]) || key;
};

window.setLanguage = function(lang) {
  currentLang = lang;
  localStorage.setItem('askif_lang', lang);

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.innerHTML = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });

  const toggleBtn = document.getElementById('lang-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = currentLang === 'zh' ? 'EN' : '中文';
  }
};

window.toggleLanguage = function() {
  window.setLanguage(currentLang === 'zh' ? 'en' : 'zh');
};

document.addEventListener('DOMContentLoaded', () => {
  window.setLanguage(currentLang);
});
