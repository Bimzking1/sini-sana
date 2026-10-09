const enabled = typeof window !== "undefined" && /[?&]debug=1/.test(window.location.search);

export function isDebugEnabled(): boolean {
  return enabled;
}

export function rtcDebug(...args: unknown[]): void {
  if (enabled) console.log("[rtc]", ...args);
}