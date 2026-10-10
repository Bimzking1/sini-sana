/**
 * Derives the signalling server's HTTPS origin from its WebSocket URL. The
 * Worker exposes TURN credentials at `/ice-servers` on the same host.
 */
export function iceServersEndpoint(signalingUrl: string): string | null {
  try {
    const url = new URL(signalingUrl);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = "/ice-servers";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Fetches short-lived ICE servers (STUN + relayed TURN credentials) from the
 * signalling server. Returns an empty list when the server is unreachable or
 * has no TURN credentials configured, so callers can fall back to env config.
 */
export async function fetchRemoteIceServers(
  signalingUrl: string,
  signal?: AbortSignal,
): Promise<RTCIceServer[]> {
  const endpoint = iceServersEndpoint(signalingUrl);
  if (!endpoint) return [];
  try {
    const response = await fetch(endpoint, { signal });
    if (!response.ok) return [];
    const data = (await response.json()) as { iceServers?: unknown };
    if (!Array.isArray(data.iceServers)) return [];
    return data.iceServers.filter(isIceServer);
  } catch {
    return [];
  }
}

function isIceServer(value: unknown): value is RTCIceServer {
  if (typeof value !== "object" || value === null) return false;
  const urls = (value as { urls?: unknown }).urls;
  if (typeof urls === "string") return true;
  return Array.isArray(urls) && urls.every((url) => typeof url === "string");
}
