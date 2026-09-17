export const TRANSLATIONS = {
  zh: {
    title: '現場即時互動問答',
    subtitle: '純邊緣記憶體運算・無痕私隱防護・會後即時銷毀',
    hostSectionTitle: '🎙️ 主辦人 / 主持人入口',
    hostDesc: '建立專屬議程房間，獲取大螢幕投影連結與即時審題戰情室。',
    createRoomBtn: '建立新會議房間',
    audienceSectionTitle: '📱 觀眾加入既有房間',
    audienceDesc: '請輸入主辦方大螢幕提供的 6 位數字房間代碼：',
    joinBtn: '進入',
    complianceTitle: '🛡️ 企業級資安與全球私隱合規架構',
    complianceBody: '本系統落實「Privacy by Design 預設隱私保護」架構：無資料庫存儲、不蒐集個人可識別資訊（Zero-PII）、提問皆於 Cloudflare 邊緣記憶體運作，會議閉幕即物理銷毀；全站通訊採 TLS 1.3 與 HMAC-SHA256 簽名防偽，保障企業現場交流合規無虞。系統設有活躍房間安全上限（725 間），杜絕資源濫用。',
    modalTitle: '🔑 自訂主持人管理密碼',
    hintTitle: '💡 設定指引：',
    hintDesc: '請自訂 4~16 位數字或英文字母作為本場會議的管理密碼。您將使用此密碼管理審核與投影大螢幕；現場觀眾直接掃碼提問，免密碼即可加入。',
    pwdPlaceholder: '請自訂管理密碼 (例如: pass888)',
    cancelBtn: '取消',
    confirmBtn: '確認開房',
    creating: '正在建立房間...',
    errorWrongPwd: '密碼格式需為 4 至 16 位字元',
    errorNet: '連線伺服器失敗，請稍候再試',
    errorInvalidRoom: '請輸入正確的 6 位數字房號',
    room: '房號',
    connected: '已連線',
    disconnected: '斷線',
    placeholder: '輸入你想探討的問題（限 200 字）...',
    submit: '送出提問',
    featuredPool: '精選提問池',
    successMsg: '提問已送達後台審核隊列！',
    emptyMsg: '請輸入問題內容！',
    rateLimitMsg: '提問太頻繁，請稍候 30 秒。',
    upvoted: '已附議'
  },
  en: {
    title: 'Real-time Live Q&A',
    subtitle: 'Edge-native memory computing · Zero-PII privacy · Session auto-purge',
    hostSectionTitle: '🎙️ Event Host / Moderator',
    hostDesc: 'Create an event session to get live display projection and moderation board.',
    createRoomBtn: 'Create New Session',
    audienceSectionTitle: '📱 Audience Join',
    audienceDesc: 'Enter the 6-digit room code shown on the host display screen:',
    joinBtn: 'Join',
    complianceTitle: '🛡️ Enterprise Security & Global Compliance',
    complianceBody: 'Strictly built on Privacy by Design: zero database persistence, zero PII collection, runs ephemerally in Cloudflare edge memory, and purges upon session termination. Protected by TLS 1.3 and HMAC-SHA256 signatures. Max capacity capped at 725 concurrent active rooms to eliminate resource exhaustion.',
    modalTitle: '🔑 Set Host Passcode',
    hintTitle: '💡 Passcode Guidance:',
    hintDesc: 'Set a custom 4-16 alphanumeric passcode for this session. You will use this passcode to moderate and push questions to the display. Audiences join via QR scan without any passcode.',
    pwdPlaceholder: 'Set your host passcode (e.g. pass888)',
    cancelBtn: 'Cancel',
    confirmBtn: 'Create Room',
    creating: 'Creating Session...',
    errorWrongPwd: 'Passcode must be between 4 and 16 characters.',
    errorNet: 'Failed to connect to relay service. Please try again.',
    errorInvalidRoom: 'Please enter a valid 6-digit room code.',
    room: 'Room',
    connected: 'Connected',
    disconnected: 'Offline',
    placeholder: 'Ask a question (Max 200 chars)...',
    submit: 'Submit Question',
    featuredPool: 'Featured Questions',
    successMsg: 'Question submitted for review!',
    emptyMsg: 'Please enter your question.',
    rateLimitMsg: 'Please wait 30 seconds before submitting again.',
    upvoted: 'Upvoted'
  }
};

export function getSavedLang() {
  const saved = localStorage.getItem('askif_lang');
  if (saved && (saved === 'zh' || saved === 'en')) return saved;
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

export function applyI18n(lang = getSavedLang()) {
  localStorage.setItem('askif_lang', lang);
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.zh;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });

  const pwdInput = document.getElementById('modal-password');
  if (pwdInput && dict.pwdPlaceholder) {
    pwdInput.placeholder = dict.pwdPlaceholder;
  }

  const btnZh = document.getElementById('btn-zh');
  const btnEn = document.getElementById('btn-en');
  if (btnZh) btnZh.classList.toggle('active', lang === 'zh');
  if (btnEn) btnEn.classList.toggle('active', lang === 'en');

  return dict;
}