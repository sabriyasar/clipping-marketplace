import { describe, expect, it } from "vitest";

import { allocateBudget, calculatePayout } from "./payout";

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

describe("allocateBudget", () => {
  it("caps a single submission's allocation at total_budget", () => {
    // floor(5151 / 1000) * 5 = 25, well above a 10 cent budget
    const allocated = allocateBudget(
      [
        {
          id: "sub-1",
          status: "approved",
          views: 5_151,
          updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        },
      ],
      10,
      5,
    );

    expect(allocated.get("sub-1")).toBe(10);
  });

  it("does not cap when the raw payout is within budget", () => {
    const allocated = allocateBudget(
      [
        {
          id: "sub-1",
          status: "approved",
          views: 13_750,
          updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        },
      ],
      100,
      5,
    );

    // floor(13_750 / 1000) * 5 = 65, under the 100 cent budget
    expect(allocated.get("sub-1")).toBe(65);
  });

  it("allocates budget across multiple submissions in approval order", () => {
    const allocated = allocateBudget(
      [
        {
          id: "sub-later",
          status: "approved",
          views: 10_000,
          updatedAt: new Date("2026-09-02T00:00:00.000Z"),
        },
        {
          id: "sub-earlier",
          status: "approved",
          views: 10_000,
          updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        },
      ],
      10,
      5,
    );

    // Both raw payouts are floor(10_000/1000)*5 = 50, but only 10 cents
    // of budget exist. The earlier-approved submission (by updatedAt)
    // gets first claim; the later one gets whatever remains.
    expect(allocated.get("sub-earlier")).toBe(10);
    expect(allocated.get("sub-later")).toBe(0);
  });

  it("ignores pending and rejected submissions", () => {
    const allocated = allocateBudget(
      [
        {
          id: "sub-pending",
          status: "pending",
          views: 5_000,
          updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        },
        {
          id: "sub-rejected",
          status: "rejected",
          views: 5_000,
          updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        },
        {
          id: "sub-approved",
          status: "approved",
          views: 5_000,
          updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        },
      ],
      100,
      5,
    );

    expect(allocated.get("sub-pending")).toBe(0);
    expect(allocated.get("sub-rejected")).toBe(0);
    expect(allocated.get("sub-approved")).toBe(25);
  });

  it("never allocates a total above total_budget across submissions", () => {
    const allocated = allocateBudget(
      [
        {
          id: "sub-1",
          status: "approved",
          views: 20_000,
          updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        },
        {
          id: "sub-2",
          status: "approved",
          views: 20_000,
          updatedAt: new Date("2026-09-02T00:00:00.000Z"),
        },
        {
          id: "sub-3",
          status: "approved",
          views: 20_000,
          updatedAt: new Date("2026-09-03T00:00:00.000Z"),
        },
      ],
      50,
      5,
    );

    const total = [...allocated.values()].reduce((sum, v) => sum + v, 0);

    expect(total).toBeLessThanOrEqual(50);
    expect(total).toBe(50);
  });
});
