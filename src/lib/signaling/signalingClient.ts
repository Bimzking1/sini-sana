import type { ClientMessage, ServerMessage } from "../../types/signaling";

export interface SignalingClientEvents {
  onMessage: (message: ServerMessage) => void;
  /** Fires when an already-open connection drops unexpectedly. */
  onClosed: () => void;
}

const MAX_JSON_BYTES = 32 * 1024;

export class SignalingClient {
  private socket: WebSocket | null = null;
  private openPromise: Promise<void> | null = null;
  private opened = false;
  private buffered: ClientMessage[] = [];

  constructor(
    private readonly url: string,
    private readonly events: SignalingClientEvents,
  ) {}

  async open(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    if (this.openPromise) return this.openPromise;

    const socket = new WebSocket(this.url);
    this.socket = socket;
    this.opened = false;

    let resolveOpen!: () => void;
    let rejectOpen!: (reason: Error) => void;
    this.openPromise = new Promise<void>((resolve, reject) => {
      resolveOpen = resolve;
      rejectOpen = reject;
    });

    socket.onopen = (): void => {
      this.opened = true;
      const pending = this.buffered;
      this.buffered = [];
      for (const message of pending) socket.send(JSON.stringify(message));
      resolveOpen();
    };

    socket.onmessage = (event): void => {
      if (typeof event.data !== "string") return;
      if (event.data.length > MAX_JSON_BYTES) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      this.events.onMessage(parsed as ServerMessage);
    };

    socket.onerror = (): void => {
      socket.close();
    };

    socket.onclose = (): void => {
      this.socket = null;
      this.openPromise = null;
      if (this.opened) {
        this.opened = false;
        this.events.onClosed();
      } else {
        rejectOpen(new Error("Unable to connect to the signaling server."));
      }
    };

    return this.openPromise;
  }

  send(message: ClientMessage): boolean {
    if (!this.socket) return false;
    if (this.socket.readyState === WebSocket.CONNECTING) {
      this.buffered.push(message);
      return true;
    }
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    this.buffered = [];
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket.close();
    }
    this.socket = null;
    this.openPromise = null;
  }
}