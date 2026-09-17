// backend/src/index.ts
import { RoomHub } from './room-hub';
import { Env } from './types';

export { RoomHub };

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

async function verifyRoomTicket(ticket: string, secret: string): Promise<{ valid: boolean; roomId: string }> {
  const parts = ticket.split('.');
  if (parts.length !== 3) return { valid: false, roomId: '' };

  const [roomId, timestamp, signature] = parts;
  if (!/^\d{6}$/.test(roomId)) return { valid: false, roomId: '' };

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
    const origin = request.headers.get('Origin') || '';
    const defaultOrigin = 'https://jackylawck.github.io';

    const isAllowed =
      origin === defaultOrigin ||
      origin.startsWith('https://jackylawck.github.io') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1');

    const allowOriginHeader = isAllowed && origin ? origin : defaultOrigin;

    // 企業級標準安全標頭
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

      const hostPassword = env.HOST_PASSWORD || '123456';
      const roomSecret = env.ROOM_SECRET || 'askif-default-edge-secret-key-2026';
      const url = new URL(request.url);

      // 端點：POST /api/create-room（主持開房並簽發 Ticket）
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
          if (!password || !timingSafeEqual(password, hostPassword)) {
            return new Response(JSON.stringify({ error: 'Unauthorized password' }), {
              status: 401,
              headers: { ...baseHeaders, 'Content-Type': 'application/json' }
            });
          }

          const roomId = generateRoomId();
          const timestamp = Date.now().toString();
          const signature = await signRoom(roomId, timestamp, roomSecret);
          const ticket = `${roomId}.${timestamp}.${signature}`;

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
          return new Response('Invalid or expired room ticket', { status: 403, headers: baseHeaders });
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