import { describe, expect, it } from "vitest";
import {
  buildRoomUrl,
  generateRoomCode,
  parseRoomCodeFromUrl,
} from "./roomId";

describe("room id helpers", () => {
  it("generates codes of the correct length from the alphabet", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code)).toBe(true);
  });

  it("produces distinct codes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(generateRoomCode());
    expect(seen.size).toBeGreaterThan(400);
  });

  it("uses the injected rng deterministically", () => {
    expect(generateRoomCode(() => 0)).toBe("AAAAAA");
    expect(generateRoomCode(() => 0.999999)).toBe(
      "ABCDEFGHJKMNPQRSTUVWXYZ23456789".charAt(30).repeat(6),
    );
  });

  it("builds shareable urls", () => {
    expect(buildRoomUrl("ABC234", "https://sinisana.test", "/app")).toBe(
      "https://sinisana.test/app#ABC234",
    );
  });

  it("parses room codes from urls", () => {
    expect(parseRoomCodeFromUrl("https://x.test/app#ABC234")).toBe("ABC234");
    expect(parseRoomCodeFromUrl("https://x.test/app#abc234")).toBe("ABC234");
    expect(parseRoomCodeFromUrl("https://x.test/app#ab-c2 34")).toBe("ABC234");
  });

  it("returns null for invalid or missing codes", () => {
    expect(parseRoomCodeFromUrl("https://x.test/app")).toBeNull();
    expect(parseRoomCodeFromUrl("https://x.test/app#")).toBeNull();
    expect(parseRoomCodeFromUrl("https://x.test/app#ABC23O")).toBeNull();
    expect(parseRoomCodeFromUrl("https://x.test/app#toolong")).toBeNull();
  });
});