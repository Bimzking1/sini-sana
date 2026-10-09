import { describe, expect, it } from "vitest";
import type { ChannelData, ControlMessage, FileStartMessage, TextMessage } from "../../types/transfer";
import { LOW_WATERMARK, HIGH_WATERMARK, waitForBufferDrain } from "./dataChannel";
import type { DataChannelLike } from "./dataChannel";
import {
  IncomingFileManager,
  handleIncomingData,
  sendFile as realSendFile,
  sendFilesSequential as realSendFilesSequential,
  sendTextMessage as realSendTextMessage,
} from "./fileTransfer";

class MockChannel implements DataChannelLike {
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  readyState: RTCDataChannelState = "open";
  onSend?: (data: string | ArrayBuffer) => void;
  failAt: number[] = [];

  private peer: MockChannel | null = null;
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();
  private sends = 0;

  setPeer(peer: MockChannel): void {
    this.peer = peer;
  }

  get sendCount(): number {
    return this.sends;
  }

  send(data: string | ArrayBuffer): void {
    if (this.readyState !== "open") {
      throw new Error("send called on a closed channel");
    }
    this.sends += 1;
    if (this.failAt.includes(this.sends)) {
      throw new Error("The peer rejected the data.");
    }

    // Healthy network: the OS buffer flushes immediately, so bufferedAmount
    // stays at zero and progress reflects bytes actually put on the wire.
    this.onSend?.(data);

    const payload = data;
    const peer = this.peer;
    queueMicrotask(() => {
      if (!peer || peer.readyState !== "open") return;
      peer.emit("message", new MessageEvent("message", { data: payload }));
    });
  }

  drain(bytes: number): void {
    this.bufferedAmount = Math.max(0, this.bufferedAmount - bytes);
    if (this.bufferedAmount <= this.bufferedAmountLowThreshold) {
      this.emit("bufferedamountlow", new Event("bufferedamountlow"));
    }
  }

  close(): void {
    this.readyState = "closed";
    this.emit("close", new Event("close"));
  }

  addEventListener(
    type: "message" | "close" | "error" | "bufferedamountlow",
    listener: (event: Event) => void,
  ): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(
    type: "message" | "close" | "error" | "bufferedamountlow",
    listener: (event: Event) => void,
  ): void {
    const set = this.listeners.get(type);
    set?.delete(listener);
  }

  private emit(type: string, event: Event): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of [...set]) listener(event);
  }
}

function makePair(): { a: MockChannel; b: MockChannel } {
  const a = new MockChannel();
  const b = new MockChannel();
  a.setPeer(b);
  b.setPeer(a);
  return { a, b };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Facade = {
  handleData(data: ChannelData, textSink: TextMessage[]): void;
  handleControl(control: ControlMessage): void;
  handleChunk(frame: { transferId: string; sequence: number; payload: ArrayBuffer }): void;
  manager: IncomingFileManager;
};

function makeFacade(
  callbacks: Partial<{
    onStart: (start: FileStartMessage) => void;
    onProgress: (id: string, received: number) => void;
    onComplete: (id: string, blob: Blob, start: FileStartMessage) => void;
    onAbort: (id: string) => void;
    onError: (id: string, message: string) => void;
  }> = {},
): Facade {
  const manager = new IncomingFileManager({
    onStart: callbacks.onStart ?? (() => undefined),
    onProgress: callbacks.onProgress ?? (() => undefined),
    onComplete: callbacks.onComplete ?? (() => undefined),
    onAbort: callbacks.onAbort ?? (() => undefined),
    onError: callbacks.onError ?? (() => undefined),
  });
  return {
    manager,
    handleData: (data, textSink) => handleIncomingData(data, manager, (m) => textSink.push(m)),
    handleControl: (control) => manager.handleControl(control),
    handleChunk: (frame) => manager.handleChunk(frame),
  };
}

describe("waitForBufferDrain", () => {
  it("resolves immediately when the buffer is already low", async () => {
    const channel = new MockChannel();
    channel.bufferedAmount = LOW_WATERMARK;
    await expect(waitForBufferDrain(channel)).resolves.toBeUndefined();
  });

  it("waits for bufferedamountlow when above the high watermark", async () => {
    const channel = new MockChannel();
    channel.bufferedAmount = HIGH_WATERMARK + 1024;
    channel.bufferedAmountLowThreshold = LOW_WATERMARK;

    let resolved = false;
    const pending = waitForBufferDrain(channel).then(() => {
      resolved = true;
    });
    await sleep(20);
    expect(resolved).toBe(false);

    channel.drain(HIGH_WATERMARK + 1024 - (LOW_WATERMARK - 1));
    await pending;
    expect(resolved).toBe(true);
  });

  it("rejects when the channel closes while waiting", async () => {
    const channel = new MockChannel();
    channel.bufferedAmount = HIGH_WATERMARK + 1024;
    channel.bufferedAmountLowThreshold = LOW_WATERMARK;

    const pending = waitForBufferDrain(channel);
    channel.close();
    await expect(pending).rejects.toThrow(/closed/);
  });
});

describe("text transfer", () => {
  it("delivers text from sender to receiver", async () => {
    const { a, b } = makePair();
    const received: TextMessage[] = [];
    const facade = makeFacade();
    b.addEventListener("message", (event) =>
      facade.handleData((event as MessageEvent).data as ChannelData, received),
    );

    const sent = realSendTextMessage(a, "hello from peer");
    await sleep(5);
    expect(received).toEqual([sent]);
  });
});

describe("file transfer", () => {
  it("sends a multi-chunk file and reassembles it at the receiver", async () => {
    const { a, b } = makePair();
    const received: TextMessage[] = [];
    const starts: FileStartMessage[] = [];
    const completed: Array<{ id: string; blob: Blob }> = [];
    const errors: string[] = [];
    const facade = makeFacade({
      onStart: (start) => starts.push(start),
      onComplete: (id, blob) => completed.push({ id, blob }),
      onError: (_id, message) => errors.push(message),
    });
    b.addEventListener("message", (event) =>
      facade.handleData((event as MessageEvent).data as ChannelData, received),
    );

    const content = new Uint8Array(50 * 1024);
    for (let i = 0; i < content.length; i += 1) content[i] = i % 251;

    const progress: number[] = [];
    await realSendFile(a, new Blob([content], { type: "image/png" }), "photo.png", {
      onProgress: (_id, _name, _bytes, p) => progress.push(p),
      onComplete: () => undefined,
    });
    await sleep(10);

    expect(errors).toEqual([]);
    expect(starts).toHaveLength(1);
    expect(starts[0]?.name).toBe("photo.png");
    expect(starts[0]?.size).toBe(content.length);
    expect(completed).toHaveLength(1);
    const completedBlob = completed[0]?.blob;
    expect(completedBlob).toBeDefined();
    const receivedBytes = new Uint8Array(await completedBlob!.arrayBuffer());
    expect(receivedBytes).toEqual(content);
    expect(completed[0]?.blob.type).toBe("image/png");
    expect(progress[progress.length - 1]).toBe(1);
    expect(progress.length).toBeGreaterThan(3);
    expect(received).toEqual([]);
  });

  it("rejects empty files", async () => {
    const { a } = makePair();
    await expect(realSendFile(a, new Blob([]), "empty.txt", {
      onProgress: () => undefined,
      onComplete: () => undefined,
    })).rejects.toThrow(/empty/);
  });

  it("continues with remaining files when one fails", async () => {
    const { a, b } = makePair();
    const received: TextMessage[] = [];
    const completed: Array<{ id: string; blob: Blob }> = [];
    const facade = makeFacade({
      onComplete: (id, blob) => completed.push({ id, blob }),
    });
    b.addEventListener("message", (event) =>
      facade.handleData((event as MessageEvent).data as ChannelData, received),
    );

    // The channel rejects send #2 (the first chunk of the first file) but stays
    // open, so the batch can continue with the remaining files.
    a.failAt = [2];

    const failed: Array<{ key: string; message: string }> = [];
    const succeeded: string[] = [];
    await realSendFilesSequential(
      a,
      [
        { key: "bad", file: new Blob([new Uint8Array(10)]), name: "bad.bin" },
        { key: "good", file: new Blob([new Uint8Array([1, 2, 3])]), name: "good.bin" },
      ],
      {
        onProgress: () => undefined,
        onComplete: (key) => succeeded.push(key),
        onError: (key, message) => failed.push({ key, message }),
      },
    );
    await sleep(10);

    expect(failed).toHaveLength(1);
    expect(failed[0]?.key).toBe("bad");
    expect(failed[0]?.message).not.toBe("");
    expect(succeeded).toEqual(["good"]);
    expect(completed.some((c) => c.blob.size === 3)).toBe(true);
  });

  it("fails an inbound transfer when chunks arrive out of order", async () => {
    const errors: Array<{ id: string; message: string }> = [];
    const facade = makeFacade({
      onError: (id, message) => errors.push({ id, message }),
    });

    facade.handleControl({
      type: "file-start",
      id: "t-1",
      name: "a.bin",
      mimeType: "application/octet-stream",
      size: 4,
    });
    facade.handleChunk({ transferId: "t-1", sequence: 1, payload: new Uint8Array([1, 2]).buffer });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("interrupted");
  });

  it("fails an inbound transfer when it ends before all bytes arrive", async () => {
    const errors: string[] = [];
    const completed: Blob[] = [];
    const facade = makeFacade({
      onComplete: (_id, blob) => completed.push(blob),
      onError: (_id, message) => errors.push(message),
    });

    facade.handleControl({
      type: "file-start",
      id: "t-2",
      name: "a.bin",
      mimeType: "application/octet-stream",
      size: 10,
    });
    facade.handleChunk({ transferId: "t-2", sequence: 0, payload: new Uint8Array([1, 2]).buffer });
    facade.handleControl({ type: "file-end", id: "t-2" });

    expect(errors).toEqual(["The transfer ended before all data arrived."]);
    expect(completed).toEqual([]);
  });

  it("marks in-flight transfers as failed when the channel closes", async () => {
    const errors: string[] = [];
    const facade = makeFacade({
      onError: (_id, message) => errors.push(message),
    });

    facade.handleControl({
      type: "file-start",
      id: "t-3",
      name: "a.bin",
      mimeType: "application/octet-stream",
      size: 10,
    });
    facade.manager.handleChannelClosed();
    expect(errors).toEqual(["Transfer interrupted because the connection closed."]);
  });

  it("ignores chunks for transfers it never started", async () => {
    const errors: string[] = [];
    const facade = makeFacade({ onError: (_id, message) => errors.push(message) });
    facade.handleChunk({ transferId: "unknown", sequence: 0, payload: new Uint8Array(1).buffer });
    expect(errors).toEqual([]);
  });
});
