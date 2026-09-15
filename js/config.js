// js/config.js
// 自動識別本機開發與生產環境，避免切換環境時誤提交
const isDev = Boolean(
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname.endsWith('.internal')
);

window.ASKIF_RELAY = isDev
  ? 'http://127.0.0.1:8787'
  : 'https://askif-relay.jackylawck.workers.dev';
