import type { ChannelData, ControlMessage, FileStartMessage, TextMessage } from "../../types/transfer";
import { MAX_FILE_SIZE } from "../../types/transfer";
import type { DataChannelLike } from "./dataChannel";
import { DEFAULT_CHUNK_SIZE, isChannelOpen, waitForBufferDrain } from "./dataChannel";
import { computeProgress } from "./progress";
import {
  createTextMessage,
  createTransferId,
  decodeFileChunkFrame,
  encodeFileChunkFrame,
  isBinaryChannelData,
  isControlChannelData,
  isFileAbortMessage,
  isFileEndMessage,
  isFileStartMessage,
  isTextMessage,
  parseControlMessage,
  type FileChunkFrame,
} from "./protocol";

export interface SendFileCallbacks {
  onProgress: (id: string, name: string, sentBytes: number, progress: number) => void;
  onComplete: (id: string) => void;
}

/** Callbacks keyed to a UI-friendly identifier instead of the protocol id. */
export interface BatchFileCallbacks {
  onProgress: (key: string, name: string, sentBytes: number, progress: number) => void;
  onComplete: (key: string) => void;
  onError: (key: string, message: string) => void;
}

export interface FileEntry {
  key: string;
  file: Blob;
  name: string;
}

export interface IncomingFileCallbacks {
  onStart: (start: FileStartMessage) => void;
  onProgress: (id: string, receivedBytes: number) => void;
  onComplete: (id: string, blob: Blob, start: FileStartMessage) => void;
  onAbort: (id: string) => void;
  onError: (id: string, message: string) => void;
}

interface PendingIncomingFile {
  start: FileStartMessage;
  chunks: BlobPart[];
  received: number;
  nextSequence: number;
}

export function sendTextMessage(channel: DataChannelLike, content: string): TextMessage {
  const message = createTextMessage(content);
  channel.send(JSON.stringify(message));
  return message;
}

/**
 * Sends a single file over the data channel in fixed-size chunks with
 * backpressure, then closes the transfer with a `file-end` message.
 */
export async function sendFile(
  channel: DataChannelLike,
  file: Blob,
  name: string,
  callbacks: SendFileCallbacks,
  opts: { chunkSize?: number } = {},
): Promise<void> {
  if (!isChannelOpen(channel)) {
    throw new Error("The connection isn't ready yet.");
  }

  const size = file.size;
  if (size > MAX_FILE_SIZE) {
    throw new Error("This file exceeds the 4 GB transfer limit.");
  }
  if (size === 0) {
    throw new Error("This file is empty.");
  }

  const id = createTransferId();
  const mimeType = file.type || "application/octet-stream";
  const chunkSize = Math.min(opts.chunkSize ?? DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_SIZE);
  const start: FileStartMessage = { type: "file-start", id, name, mimeType, size };
  channel.send(JSON.stringify(start));

  let offset = 0;
  let sequence = 0;
  let submittedBytes = 0;

  const reportProgress = (): void => {
    const onWire = Math.max(0, submittedBytes - channel.bufferedAmount);
    callbacks.onProgress(id, name, onWire, computeProgress(onWire, size));
  };

  try {
    while (offset < size) {
      const end = Math.min(offset + chunkSize, size);
      const slice = file.slice(offset, end);
      const payload = await slice.arrayBuffer();
      channel.send(encodeFileChunkFrame(id, sequence, payload));
      submittedBytes += payload.byteLength;
      sequence += 1;
      offset = end;
      reportProgress();
      await waitForBufferDrain(channel);
    }
    channel.send(JSON.stringify({ type: "file-end", id }));
    callbacks.onComplete(id);
  } catch (error) {
    channel.send(JSON.stringify({ type: "file-abort", id }));
    throw error;
  }
}

/**
 * Sends multiple files one after another over a single data channel. If one
 * file fails, the remaining files are still attempted.
 */
export async function sendFilesSequential(
  channel: DataChannelLike,
  entries: FileEntry[],
  callbacks: BatchFileCallbacks,
): Promise<void> {
  for (const entry of entries) {
    try {
      await sendFile(channel, entry.file, entry.name, {
        onProgress: (_id, name, sentBytes, progress) =>
          callbacks.onProgress(entry.key, name, sentBytes, progress),
        onComplete: () => callbacks.onComplete(entry.key),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The file could not be sent.";
      callbacks.onError(entry.key, message);
    }
  }
}

/** Tracks an inbound file transfer and reassembles the original Blob. */
export class IncomingFileManager {
  private readonly pending: Map<string, PendingIncomingFile> = new Map();

  constructor(private readonly callbacks: IncomingFileCallbacks) {}

  handleControl(control: ControlMessage): void {
    if (isFileStartMessage(control)) this.start(control);
    else if (isFileEndMessage(control)) this.complete(control.id);
    else if (isFileAbortMessage(control)) this.abort(control.id);
  }

  handleChunk(frame: FileChunkFrame): void {
    const pending = this.pending.get(frame.transferId);
    if (!pending) return;
    if (frame.sequence !== pending.nextSequence) {
      this.fail(pending, "The transfer was interrupted.");
      return;
    }
    if (pending.received + frame.payload.byteLength > pending.start.size) {
      this.fail(pending, "The received data didn't match the file size.");
      return;
    }
    pending.chunks.push(frame.payload);
    pending.received += frame.payload.byteLength;
    pending.nextSequence += 1;
    this.callbacks.onProgress(frame.transferId, pending.received);
  }

  /** Marks every in-flight transfer as interrupted (e.g. channel closed). */
  handleChannelClosed(): void {
    for (const pending of this.pending.values()) {
      this.fail(pending, "Transfer interrupted because the connection closed.");
    }
  }

  dispose(): void {
    this.pending.clear();
  }

  private start(start: FileStartMessage): void {
    const existing = this.pending.get(start.id);
    if (existing) {
      this.fail(existing, "Transfer was replaced by a newer one.");
    }
    this.pending.set(start.id, {
      start,
      chunks: [],
      received: 0,
      nextSequence: 0,
    });
    this.callbacks.onStart(start);
  }

  private complete(id: string): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    if (pending.received !== pending.start.size) {
      this.fail(pending, "The transfer ended before all data arrived.");
      return;
    }
    this.pending.delete(id);
    const blob = new Blob(pending.chunks, { type: pending.start.mimeType });
    this.callbacks.onComplete(id, blob, pending.start);
  }

  private abort(id: string): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    this.callbacks.onAbort(id);
  }

  private fail(pending: PendingIncomingFile, message: string): void {
    this.pending.delete(pending.start.id);
    this.callbacks.onError(pending.start.id, message);
  }
}

/**
 * Routes raw data-channel traffic: control messages go to the file manager,
 * text messages surface immediately, binary frames reassemble into chunks.
 */
export function handleIncomingData(
  data: ChannelData,
  incoming: IncomingFileManager,
  onText: (message: TextMessage) => void,
): void {
  if (isControlChannelData(data)) {
    const control = parseControlMessage(data);
    if (!control) return;
    if (isTextMessage(control)) onText(control);
    else incoming.handleControl(control);
  } else if (isBinaryChannelData(data)) {
    const frame = decodeFileChunkFrame(data);
    if (frame) incoming.handleChunk(frame);
  }
}