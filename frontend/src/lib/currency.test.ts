import { describe, expect, it } from "vitest";
import { formatInrAmount } from "./currency";

describe("formatInrAmount", () => {
  it("formats rupees with two decimal places", () => {
    expect(formatInrAmount(250)).toBe("₹250.00");
  });

  it("uses Indian digit grouping for larger amounts", () => {
    expect(formatInrAmount(125000)).toBe("₹1,25,000.00");
  });
});
