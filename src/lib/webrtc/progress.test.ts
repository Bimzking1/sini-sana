import { describe, expect, it } from "vitest";
import {
  computeProgress,
  formatBytes,
  formatPercent,
  formatProgressTotal,
} from "./progress";

describe("progress helpers", () => {
  it("clamps progress to [0, 1]", () => {
    expect(computeProgress(0, 100)).toBe(0);
    expect(computeProgress(50, 100)).toBe(0.5);
    expect(computeProgress(150, 100)).toBe(1);
    expect(computeProgress(0, 0)).toBe(1);
    expect(computeProgress(-5, 10)).toBe(0);
  });

  it("formats percents", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.1234)).toBe("12%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("formats byte sizes humanly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(-1)).toBe("0 B");
  });

  it("combines completed and total", () => {
    expect(formatProgressTotal(500, 2048)).toBe("500 B / 2 KB");
  });
});