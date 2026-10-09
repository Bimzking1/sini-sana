import { describe, expect, it } from "vitest";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
} from "./roomCode.js";

describe("room code rules", () => {
  it("exposes the expected length and unambiguous alphabet", () => {
    expect(ROOM_CODE_LENGTH).toBe(6);
    for (const banned of ["0", "O", "1", "I", "L"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(banned);
    }
    expect(ROOM_CODE_ALPHABET).toHaveLength(31);
  });

  it("normalizes case and whitespace", () => {
    expect(normalizeRoomCode("  ab c-23 4 ")).toBe("ABC234");
    expect(normalizeRoomCode("abc234")).toBe("ABC234");
    expect(isValidRoomCode("A B C 2 3 4")).toBe(true);
  });

  it("rejects wrong lengths", () => {
    expect(normalizeRoomCode("")).toBeNull();
    expect(normalizeRoomCode("AB12")).toBeNull();
    expect(normalizeRoomCode("ABC1234")).toBeNull();
  });

  it("rejects characters outside the alphabet", () => {
    expect(normalizeRoomCode("ABC120")).toBeNull();
    expect(normalizeRoomCode("ABCO23")).toBeNull();
    expect(normalizeRoomCode("ABC!23")).toBeNull();
    expect(isValidRoomCode("ABC12I")).toBe(false);
  });
});