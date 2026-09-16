// backend/src/types.ts
export interface RateLimitBinding {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

export interface Env {
  ROOM_HUB: DurableObjectNamespace;
  HOST_PASSWORD: string;       // 主持人開房與認證密鑰 (wrangler secret)
  ROOM_SECRET: string;         // 房號 HMAC 防偽簽名私鑰 (wrangler secret)
  AUTH_RATE_LIMITER?: RateLimitBinding; // Cloudflare 原生限流器
  ALLOWED_ORIGINS?: string;    // 可選環境變數，用逗號分隔
}