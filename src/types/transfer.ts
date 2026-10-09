export const MAX_TRANSFER_ID_LENGTH = 64;
export const MAX_FILE_NAME_LENGTH = 255;
export const MAX_MIME_TYPE_LENGTH = 128;
export const MAX_FILE_SIZE = 4 * 1024 ** 3;

export interface TextMessage {
  type: "text";
  id: string;
  content: string;
  timestamp: number;
}

export interface FileStartMessage {
  type: "file-start";
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface FileEndMessage {
  type: "file-end";
  id: string;
}

export interface FileAbortMessage {
  type: "file-abort";
  id: string;
  reason?: string;
}

export type ControlMessage = TextMessage | FileStartMessage | FileEndMessage | FileAbortMessage;

export type ChannelData = string | ArrayBuffer;

/** Events surfaced when data arrives from the remote peer. */
export type IncomingTransferEvent =
  | { kind: "text"; message: TextMessage }
  | { kind: "file-start"; id: string; name: string; size: number; mimeType: string }
  | { kind: "file-progress"; id: string; received: number }
  | { kind: "file-complete"; id: string; name: string; mimeType: string; blob: Blob }
  | { kind: "file-cancelled"; id: string }
  | { kind: "file-failed"; id: string; message: string };

export type TransferDirection = "sent" | "received";

export type TransferState = "progress" | "done" | "failed" | "aborted";

/** A single item in the in-memory transfer history shown to the user. */
export type TransferItem =
  | {
      id: string;
      direction: TransferDirection;
      kind: "text";
      content: string;
      timestamp: number;
      state: TransferState;
    }
  | {
      id: string;
      direction: TransferDirection;
      kind: "file";
      name: string;
      size: number;
      mimeType: string;
      timestamp: number;
      state: TransferState;
      progress: number;
      blob?: Blob;
      error?: string;
    };