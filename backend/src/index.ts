import { RoomHub } from './room-hub';
export { RoomHub };

interface Env {
  ROOM_HUB: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const roomId = url.searchParams.get('room') || 'default';
    const id = env.ROOM_HUB.idFromName(roomId);
    return env.ROOM_HUB.get(id).fetch(request);
  }
};
