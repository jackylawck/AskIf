const translations = {
  zh: {
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
    host_page_title: "AskIf — 主持人戰情 Pad",
    room_label: "房號",
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
    btn_active: "🌟 播映中"
  },
  en: {
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
    host_page_title: "AskIf — Host Control Pad",
    room_label: "Room",
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
    btn_active: "🌟 On Screen"
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
