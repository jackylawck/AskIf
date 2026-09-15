// js/i18n.js
const translations = {
  zh: {
    status_connected: "● 已同步雲端中繼",
    status_reconnecting: "○ 斷線重試中...",
    room_label: "房號",
    open_display: "🖥️ 開大螢幕",
    qr_hint: "📱 觀眾現場掃碼加入<br>純記憶體運作，關閉分頁即物理銷毀。",
    inbox_title: "📥 待審題庫",
    approved_title: "🚀 候選與大螢幕推題",
    btn_approve: "✅ 通過",
    btn_reject: "❌ 刪除",
    btn_hold_push: "長按推題 (0.8s)",
    btn_pushing: "推題中...",
    btn_active: "🌟 播映中",
    // 觀眾端 (Audience)
    audience_title: "現場提問",
    input_placeholder: "輸入你想提問的內容...",
    btn_submit: "送出提問",
    pool_title: "🔥 精選提問池",
    btn_upvote: "▲ 附議",
    toast_sent: "提問已送達後台審核隊列！",
    toast_empty: "請先輸入內容再送出。"
  },
  en: {
    status_connected: "● Cloud Relay Synced",
    status_reconnecting: "○ Reconnecting...",
    room_label: "Room",
    open_display: "🖥️ Open Screen",
    qr_hint: "📱 Scan QR Code to Join<br>In-memory execution, purged on tab close.",
    inbox_title: "📥 Pending Moderation",
    approved_title: "🚀 Candidate & Push to Screen",
    btn_approve: "✅ Approve",
    btn_reject: "❌ Delete",
    btn_hold_push: "Hold to Push (0.8s)",
    btn_pushing: "Pushing...",
    btn_active: "🌟 On Screen",
    // Audience
    audience_title: "Live Q&A",
    input_placeholder: "Type your question here...",
    btn_submit: "Submit",
    pool_title: "🔥 Featured Questions",
    btn_upvote: "▲ Upvote",
    toast_sent: "Submitted to review queue!",
    toast_empty: "Please type something before submitting."
  }
};

let currentLang = localStorage.getItem('askif_lang') || 'zh';

function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || key;
}

function setLanguage(lang) {
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
}

function toggleLanguage() {
  setLanguage(currentLang === 'zh' ? 'en' : 'zh');
}

// 頁面載入時自動初始化語言
document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
});
