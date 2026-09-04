import { describe, expect, it } from "vitest";

import { calculatePayout } from "./payout";

describe("calculatePayout", () => {
  it("returns zero below 1,000 views", () => {
    expect(calculatePayout(999, 500)).toBe(0);
  });

  it("calculates payout for exactly 1,000 views", () => {
    expect(calculatePayout(1000, 500)).toBe(500);
  });

  it("uses floor for partial thousands", () => {
    expect(calculatePayout(2999, 500)).toBe(1000);
  });

  it("calculates payout for large view counts", () => {
    expect(calculatePayout(10500, 500)).toBe(5000);
  });
});
