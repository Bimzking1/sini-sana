import { useEffect, useMemo, useState } from "react";
import { fetchRemoteIceServers } from "../lib/iceServers";
import { mergeIceServers } from "../lib/webrtc/iceConfig";
import type { AppConfig } from "../lib/config";

/**
 * Returns the ICE servers to use for a room: the env-configured STUN/TURN plus
 * any short-lived TURN credentials the signalling server hands out. Remote
 * credentials are fetched once and merged in; failures silently keep the env
 * configuration so connecting still works offline.
 */
export function useIceServers(config: AppConfig): RTCIceServer[] {
  const [remote, setRemote] = useState<RTCIceServer[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchRemoteIceServers(config.signalingUrl, controller.signal).then((servers) => {
      if (!controller.signal.aborted) setRemote(servers);
    });
    return () => controller.abort();
  }, [config.signalingUrl]);

  return useMemo(
    () => mergeIceServers(config.iceServers, remote),
    [config.iceServers, remote],
  );
}
