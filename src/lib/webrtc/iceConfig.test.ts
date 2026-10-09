import { describe, expect, it } from "vitest";
import { buildIceServers, parseStunServerList } from "./iceConfig";

describe("stun server parsing", () => {
  it("splits, trims and drops empty entries", () => {
    expect(parseStunServerList("a.example, b.example ,, c.example")).toEqual([
      "a.example",
      "b.example",
      "c.example",
    ]);
    expect(parseStunServerList("  ")).toEqual([]);
  });
});

describe("buildIceServers", () => {
  it("builds one entry per stun server", () => {
    const config = buildIceServers({ stunServers: "a:1, b:2" });
    expect(config.iceServers).toEqual([{ urls: "a:1" }, { urls: "b:2" }]);
  });

  it("adds turn with credentials when both are present", () => {
    const config = buildIceServers({
      stunServers: "",
      turnUrl: "turn:x",
      turnUsername: "user",
      turnCredential: "secret",
    });
    expect(config.iceServers).toEqual([
      { urls: "turn:x", username: "user", credential: "secret" },
    ]);
  });

  it("does not attach credentials when either is missing", () => {
    const config = buildIceServers({
      stunServers: "",
      turnUrl: "turn:x",
      turnUsername: "user",
    });
    expect(config.iceServers).toEqual([{ urls: "turn:x" }]);
  });
});