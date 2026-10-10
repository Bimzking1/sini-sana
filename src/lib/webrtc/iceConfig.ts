import type { IceServersConfig } from "../../types/webrtc";

export interface IceEnvironment {
  stunServers: string;
  turnUrl?: string;
  turnUsername?: string;
  turnCredential?: string;
}

export function parseServerList(raw: string): string[] {
  return raw
    .split(",")
    .map((server) => server.trim())
    .filter((server) => server.length > 0);
}

/**
 * Builds the ICE server list for an RTCPeerConnection. TURN credentials are
 * only attached when both a username and credential are provided. `turnUrl`
 * accepts a comma-separated list so a single relay can advertise several
 * transports (UDP, TCP and TLS) for restrictive networks.
 */
export function buildIceServers(env: IceEnvironment): IceServersConfig {
  const iceServers: RTCIceServer[] = [];

  for (const urls of parseServerList(env.stunServers)) {
    iceServers.push({ urls });
  }

  if (env.turnUrl && env.turnUrl.trim().length > 0) {
    const urls = parseServerList(env.turnUrl);
    if (urls.length > 0) {
      const hasCredentials =
        env.turnUsername !== undefined && env.turnCredential !== undefined;
      iceServers.push(
        hasCredentials
          ? { urls, username: env.turnUsername, credential: env.turnCredential }
          : { urls },
      );
    }
  }

  return { iceServers };
}

/**
 * Concatenates ICE server lists, dropping entries whose URL set was already
 * seen. Lets the env-configured servers and the signalling server's
 * short-lived TURN credentials coexist without duplicates.
 */
export function mergeIceServers(...groups: RTCIceServer[][]): RTCIceServer[] {
  const merged: RTCIceServer[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const server of group) {
      const key = iceServerKey(server);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(server);
    }
  }
  return merged;
}

function iceServerKey(server: RTCIceServer): string {
  const urls = Array.isArray(server.urls) ? [...server.urls].sort() : [server.urls];
  return urls.join("|");
}
