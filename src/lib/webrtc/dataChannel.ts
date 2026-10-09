/**
 * Minimal structural interface for the pieces of RTCDataChannel that the
 * transfer logic relies on. Kept narrow so the transfer engine can be
 * tested with an in-memory fake channel.
 */
export interface DataChannelLike {
  send(data: string | ArrayBuffer): void;
  readonly bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  readonly readyState: RTCDataChannelState;
  close(): void;
  addEventListener(
    type: "message" | "close" | "error" | "bufferedamountlow",
    listener: (event: Event) => void,
  ): void;
  removeEventListener(
    type: "message" | "close" | "error" | "bufferedamountlow",
    listener: (event: Event) => void,
  ): void;
}

/** Chunk payload size: small enough to fit message limits on Chrome and Safari. */
export const DEFAULT_CHUNK_SIZE = 16 * 1024;

/** Pause sending chunks once this much data sits in the outbound buffer. */
export const HIGH_WATERMARK = 1024 * 1024;

/** The DataChannel fires `bufferedamountlow` when it drops to this threshold. */
export const LOW_WATERMARK = 256 * 1024;

export function isChannelOpen(channel: DataChannelLike): boolean {
  return channel.readyState === "open";
}

/**
 * Waits until the DataChannel buffer drains below the low watermark.
 * Used together with `bufferedAmountLowThreshold` to avoid overflowing
 * the browser's buffer when sending large files.
 */
export function waitForBufferDrain(
  channel: DataChannelLike,
  opts: { highWatermark?: number; lowWatermark?: number } = {},
): Promise<void> {
  const highWatermark = opts.highWatermark ?? HIGH_WATERMARK;
  const lowWatermark = opts.lowWatermark ?? LOW_WATERMARK;

  if (channel.bufferedAmount <= lowWatermark) {
    return Promise.resolve();
  }
  if (channel.bufferedAmount < highWatermark) {
    // Already below the high watermark; keep going.
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const onDrained = (): void => {
      cleanup();
      resolve();
    };
    const onClosed = (): void => {
      cleanup();
      reject(new Error("The data channel closed before the transfer finished."));
    };
    const onError = (): void => {
      cleanup();
      reject(new Error("The data channel reported an error."));
    };

    const poll = globalThis.setInterval(() => {
      if (channel.bufferedAmount <= lowWatermark) onDrained();
    }, 250);

    const cleanup = (): void => {
      globalThis.clearInterval(poll);
      channel.removeEventListener("bufferedamountlow", onDrained);
      channel.removeEventListener("close", onClosed);
      channel.removeEventListener("error", onError);
    };

    channel.addEventListener("bufferedamountlow", onDrained);
    channel.addEventListener("close", onClosed);
    channel.addEventListener("error", onError);

    // Events fire only when crossing the threshold from above; re-check in
    // case the buffer already drained between scheduling and this check.
    if (channel.bufferedAmount <= lowWatermark) onDrained();
  });
}