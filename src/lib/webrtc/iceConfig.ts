import type { IceServersConfig } from "../../types/webrtc";

export interface IceEnvironment {
  stunServers: string;
  turnUrl?: string;
  turnUsername?: string;
  turnCredential?: string;
}

export function parseStunServerList(raw: string): string[] {
  return raw
    .split(",")
    .map((server) => server.trim())
    .filter((server) => server.length > 0);
}

/**
 * Builds the ICE server list for an RTCPeerConnection. TURN credentials are
 * only attached when both a username and credential are provided.
 */
export function buildIceServers(env: IceEnvironment): IceServersConfig {
  const iceServers: RTCIceServer[] = [];

  for (const urls of parseStunServerList(env.stunServers)) {
    iceServers.push({ urls });
  }

  if (env.turnUrl && env.turnUrl.trim().length > 0) {
    const urls = env.turnUrl.trim();
    const hasCredentials =
      env.turnUsername !== undefined && env.turnCredential !== undefined;
    iceServers.push(
      hasCredentials
        ? { urls, username: env.turnUsername, credential: env.turnCredential }
        : { urls },
    );
  }

  return { iceServers };
}