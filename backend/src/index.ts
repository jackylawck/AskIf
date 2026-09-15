// backend/src/index.ts
import { RoomHub } from './room-hub';
import { Env } from './types';

export { RoomHub };

// 常數時間比較，杜絕時序攻擊
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// 密碼學安全隨機產生 6 位房號
function generateRoomId(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

// 256-bit HMAC-SHA256 簽名（Base64URL）
async function signRoom(roomId: string, timestamp: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${roomId}:${timestamp}`));
  const binary = String.fromCharCode(...new Uint8Array(sig));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 驗證票據
async function verifyRoomTicket(ticket: string, secret: string): Promise<{ valid: boolean; roomId: string }> {
  const parts = ticket.split('.');
  if (parts.length !== 3) return { valid: false, roomId: '' };

  const [roomId, timestamp, signature] = parts;

  if (!/^\d{6}$/.test(roomId)) return { valid: false, roomId: '' };

  // 24 小時有效期（允許邊緣 NTP 時鐘偏差 5 分鐘）
  const ts = Number(timestamp);
  const now = Date.now();
  if (isNaN(ts) || now - ts > 86400000 || ts > now + 300000) {
    return { valid: false, roomId: '' };
  }

  const expectedSig = await signRoom(roomId, timestamp, secret);
  return { valid: timingSafeEqual(signature, expectedSig), roomId };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');

    // 1. Origin 防禦：預設僅允許生產環境網域，開發環境需由環境變數明確注入
    const allowedList = new Set(
      (env.ALLOWED_ORIGINS || 'https://jackylawck.github.io')
        .split(',')
        .map(s => s.trim())
    );

    if (origin && !allowedList.has(origin)) {
      return new Response('Forbidden origin', { status: 403 });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin && allowedList.has(origin) ? origin : 'https://jackylawck.github.io',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. 核心配置紀律：缺少 Secret 或限流器綁定直接拋 500 拒絕服務（嚴禁裸奔 Fallback）
    if (!env.HOST_PASSWORD || !env.ROOM_SECRET) {
      console.error('[CRITICAL] Missing HOST_PASSWORD or ROOM_SECRET.');
      return new Response('Server configuration missing secrets', { status: 500 });
    }

    if (!env.AUTH_RATE_LIMITER) {
      console.error('[CRITICAL] AUTH_RATE_LIMITER binding is missing.');
      return new Response('Server configuration missing rate limiter', { status: 500 });
    }

    const url = new URL(request.url);

    // -------------------------------------------------------------
    // 端點 A: POST /api/create-room (開房端點)
    // -------------------------------------------------------------
    if (url.pathname === '/api/create-room' && request.method === 'POST') {
      // (1) Content-Type 嚴格校驗
      const contentType = request.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        return new Response('Unsupported Media Type', { status: 415, headers: corsHeaders });
      }

      // (2) 分塊傳輸 (Chunked) 流式尺寸計數防禦（嚴格 1KB 上限）
      let bodyText = '';
      if (request.body) {
        const reader = request.body.getReader();
        let received = 0;
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.length;
          if (received > 1024) {
            await reader.cancel();
            return new Response('Payload too large', { status: 413, headers: corsHeaders });
          }
          bodyText += decoder.decode(value, { stream: true });
        }
        bodyText += decoder.decode();
      }

      // (3) Cloudflare 全局原生分佈式限流防爆破
      const clientIp = request.headers.get('CF-Connecting-IP') || 'global';
      const { success } = await env.AUTH_RATE_LIMITER.limit({ key: clientIp });
      if (!success) {
        return new Response(JSON.stringify({ error: 'Too many requests, please slow down.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const { password } = JSON.parse(bodyText);
        if (!password || !timingSafeEqual(password, env.HOST_PASSWORD)) {
          return new Response(JSON.stringify({ error: 'Unauthorized password' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 簽發 24 小時防偽房號 Ticket
        const roomId = generateRoomId();
        const timestamp = Date.now().toString();
        const signature = await signRoom(roomId, timestamp, env.ROOM_SECRET);
        const ticket = `${roomId}.${timestamp}.${signature}`;

        return new Response(JSON.stringify({ roomId, ticket }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch {
        return new Response('Malformed JSON body', { status: 400, headers: corsHeaders });
      }
    }

    // -------------------------------------------------------------
    // 端點 B: WebSocket 升級路由 (非 WS 邊緣 426 阻斷，零 DO 冷啟動)
    // -------------------------------------------------------------
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('AskIf Relay: Expected WebSocket connection', {
        status: 426,
        headers: { Upgrade: 'websocket' }
      });
    }

    const roomParam = url.searchParams.get('room');
    if (!roomParam) {
      return new Response('Missing room ticket', { status: 400 });
    }

    // 防枚舉驗簽：票證不合法在邊緣直接 403，連 1 個 DO 實例都生不出來
    const { valid, roomId } = await verifyRoomTicket(roomParam, env.ROOM_SECRET);
    if (!valid) {
      return new Response('Invalid or expired room ticket', { status: 403 });
    }

    // 一致性雜湊調度
    const id = env.ROOM_HUB.idFromName(roomId);
    return env.ROOM_HUB.get(id).fetch(request);
  }
};
