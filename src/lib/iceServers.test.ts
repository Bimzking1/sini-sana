import { describe, expect, it } from "vitest";
import { iceServersEndpoint } from "./iceServers";

describe("iceServersEndpoint", () => {
  it("maps ws/wss to http/https on the /ice-servers path", () => {
    expect(iceServersEndpoint("wss://signal.example.com")).toBe(
      "https://signal.example.com/ice-servers",
    );
    expect(iceServersEndpoint("ws://localhost:3001")).toBe(
      "http://localhost:3001/ice-servers",
    );
  });

  it("drops any path, query and hash from the signalling URL", () => {
    expect(iceServersEndpoint("wss://signal.example.com/ws?room=1#frag")).toBe(
      "https://signal.example.com/ice-servers",
    );
  });

  it("returns null for an invalid URL", () => {
    expect(iceServersEndpoint("not a url")).toBeNull();
  });
});
