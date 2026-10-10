import { describe, expect, it } from "vitest";
import { buildIceServers, mergeIceServers, parseServerList } from "./iceConfig";

describe("server list parsing", () => {
  it("splits, trims and drops empty entries", () => {
    expect(parseServerList("a.example, b.example ,, c.example")).toEqual([
      "a.example",
      "b.example",
      "c.example",
    ]);
    expect(parseServerList("  ")).toEqual([]);
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
      { urls: ["turn:x"], username: "user", credential: "secret" },
    ]);
  });

  it("supports a comma-separated list of turn transports", () => {
    const config = buildIceServers({
      stunServers: "",
      turnUrl: "turn:x:3478?transport=udp, turns:x:5349?transport=tcp",
      turnUsername: "user",
      turnCredential: "secret",
    });
    expect(config.iceServers).toEqual([
      {
        urls: ["turn:x:3478?transport=udp", "turns:x:5349?transport=tcp"],
        username: "user",
        credential: "secret",
      },
    ]);
  });

  it("does not attach credentials when either is missing", () => {
    const config = buildIceServers({
      stunServers: "",
      turnUrl: "turn:x",
      turnUsername: "user",
    });
    expect(config.iceServers).toEqual([{ urls: ["turn:x"] }]);
  });
});

describe("mergeIceServers", () => {
  it("concatenates lists and drops duplicate url sets", () => {
    const merged = mergeIceServers(
      [{ urls: "stun:a" }, { urls: "turn:x" }],
      [{ urls: "stun:a" }, { urls: "turn:y", username: "u", credential: "c" }],
    );
    expect(merged).toEqual([
      { urls: "stun:a" },
      { urls: "turn:x" },
      { urls: "turn:y", username: "u", credential: "c" },
    ]);
  });

  it("treats reordered url arrays as duplicates", () => {
    const config = mergeIceServers(
      [{ urls: ["a", "b"] }],
      [{ urls: ["b", "a"] }],
    );
    expect(config).toEqual([{ urls: ["a", "b"] }]);
  });
});
