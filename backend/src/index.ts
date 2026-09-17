// backend/src/index.ts
import { RoomHub } from './room-hub';
import { Env } from './types';

export { RoomHub };

const MAX_ACTIVE_ROOMS = 725;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function generateRoomId(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

// 密碼 SHA-256 快速摘要（避免明文傳輸）
async function hashPasscode(pass: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(pass));
  const binary = String.fromCharCode(...new Uint8Array(hash));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').substring(0, 16);
}

// 將 roomId、密碼 hash、時間戳記以 HMAC-SHA256 簽署
async function signRoom(roomId: string, passHash: string, timestamp: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${roomId}:${passHash}:${timestamp}`));
  const binary = String.fromCharCode(...new Uint8Array(sig));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 驗證 4 段式 Ticket: roomId.passHash.timestamp.signature
async function verifyRoomTicket(ticket: string, secret: string): Promise<{ valid: boolean; roomId: string; passHash: string }> {
  const parts = ticket.split('.');
  if (parts.length !== 4) return { valid: false, roomId: '', passHash: '' };

  const [roomId, passHash, timestamp, signature] = parts;
  if (!/^\d{6}$/.test(roomId)) return { valid: false, roomId: '', passHash: '' };

  const ts = Number(timestamp);
  const now = Date.now();
  if (isNaN(ts) || now - ts > 86400000 || ts > now + 300000) {
    return { valid: false, roomId: '', passHash: '' };
  }

  const expectedSig = await signRoom(roomId, passHash, timestamp, secret);
  return { valid: timingSafeEqual(signature, expectedSig), roomId, passHash };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const defaultOrigin = 'https://jackylawck.github.io';

    const isAllowed =
      origin === defaultOrigin ||
      origin.startsWith('https://jackylawck.github.io') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1');

    const allowOriginHeader = isAllowed && origin ? origin : defaultOrigin;

    const baseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': allowOriginHeader,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: baseHeaders });
    }

    try {
      if (origin && !isAllowed) {
        return new Response('Forbidden origin', { status: 403, headers: baseHeaders });
      }

      const roomSecret = env.ROOM_SECRET || 'askif-custom-secret-seed-2026';
      const url = new URL(request.url);

      // 端點：POST /api/create-room（主持人自訂密碼開房）
      if (url.pathname === '/api/create-room' && request.method === 'POST') {
        const contentType = request.headers.get('Content-Type') || '';
        if (!contentType.includes('application/json')) {
          return new Response('Unsupported Media Type', { status: 415, headers: baseHeaders });
        }

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
              return new Response('Payload too large', { status: 413, headers: baseHeaders });
            }
            bodyText += decoder.decode(value, { stream: true });
          }
          bodyText += decoder.decode();
        }

        // 頻率限制
        if (env.AUTH_RATE_LIMITER) {
          const clientIp = request.headers.get('CF-Connecting-IP') || 'global';
          const { success } = await env.AUTH_RATE_LIMITER.limit({ key: clientIp });
          if (!success) {
            return new Response(JSON.stringify({ error: 'Too many requests, please slow down.' }), {
              status: 429,
              headers: { ...baseHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        try {
          const { password } = JSON.parse(bodyText || '{}');
          if (!password || typeof password !== 'string' || password.trim().length < 4 || password.length > 20) {
            return new Response(JSON.stringify({ error: 'Passcode must be between 4 and 20 characters.' }), {
              status: 400,
              headers: { ...baseHeaders, 'Content-Type': 'application/json' }
            });
          }

          // 檢查 725 間活躍房間上限 (透過 Coordinator Durable Object 計數)
          const coordId = env.ROOM_HUB.idFromName('__GLOBAL_COORDINATOR__');
          const coordObj = env.ROOM_HUB.get(coordId);
          const countCheck = await coordObj.fetch('http://coord/check-limit');
          if (countCheck.status === 503) {
            return new Response(JSON.stringify({ error: `System room capacity reached (${MAX_ACTIVE_ROOMS}/${MAX_ACTIVE_ROOMS}). Please retry later.` }), {
              status: 503,
              headers: { ...baseHeaders, 'Content-Type': 'application/json' }
            });
          }

          const roomId = generateRoomId();
          const passHash = await hashPasscode(password.trim());
          const timestamp = Date.now().toString();
          const signature = await signRoom(roomId, passHash, timestamp, roomSecret);
          const ticket = `${roomId}.${passHash}.${timestamp}.${signature}`;

          return new Response(JSON.stringify({ roomId, ticket }), {
            status: 200,
            headers: { ...baseHeaders, 'Content-Type': 'application/json' }
          });
        } catch {
          return new Response('Malformed JSON body', { status: 400, headers: baseHeaders });
        }
      }

      // 端點：WebSocket 升級與房間轉發
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('AskIf Relay: Expected WebSocket connection', {
          status: 426,
          headers: { ...baseHeaders, Upgrade: 'websocket' }
        });
      }

      const roomParam = url.searchParams.get('room');
      if (!roomParam) {
        return new Response('Missing room ticket or ID', { status: 400, headers: baseHeaders });
      }

      const requestedRole = (url.searchParams.get('role') || 'audience').toLowerCase();
      let targetRoomId = '';

      if (requestedRole === 'host') {
        const { valid, roomId } = await verifyRoomTicket(roomParam, roomSecret);
        if (!valid) {
          return new Response('Invalid or expired host ticket', { status: 403, headers: baseHeaders });
        }
        targetRoomId = roomId;
      } else {
        if (!/^\d{6}$/.test(roomParam)) {
          return new Response('Invalid room ID format', { status: 400, headers: baseHeaders });
        }
        targetRoomId = roomParam;
      }

      const id = env.ROOM_HUB.idFromName(targetRoomId);
      return env.ROOM_HUB.get(id).fetch(request);

    } catch (err: any) {
      console.error('[Worker Unhandled Error]', err);
      return new Response(JSON.stringify({ error: err?.message || 'Internal Server Error' }), {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};