import { buildIceServers } from "./webrtc/iceConfig";

const DEFAULT_STUN_SERVER = "stun:stun.l.google.com:19302";

export interface AppConfig {
  signalingUrl: string;
  iceServers: RTCIceServer[];
}

export function loadAppConfig(env: ImportMetaEnv = import.meta.env): AppConfig {
  const stunServers = env.VITE_STUN_SERVER?.trim() || DEFAULT_STUN_SERVER;
  const iceServers = buildIceServers({
    stunServers,
    turnUrl: env.VITE_TURN_URL,
    turnUsername: env.VITE_TURN_USERNAME,
    turnCredential: env.VITE_TURN_CREDENTIAL,
  }).iceServers;

  return {
    signalingUrl: resolveSignalingUrl(env),
    iceServers,
  };
}

function resolveSignalingUrl(env: ImportMetaEnv): string {
  const explicit = env.VITE_SIGNALING_URL?.trim();
  if (explicit) return explicit;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  const scheme = secure ? "wss:" : "ws:";
  const host = typeof location !== "undefined" ? location.hostname : "localhost";
  return `${scheme}//${host}:3001`;
}