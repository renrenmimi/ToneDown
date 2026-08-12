import { afterEach, describe, expect, it, vi } from "vitest";
import { computeStreak } from "./useGym";
import type { DrillProgressRecord } from "@/shared/storage/records";

// CI runs in UTC, which has no DST — pinning the zone is what makes these
// assertions meaningful rather than trivially green. Node re-reads TZ per Date
// operation, so stubbing the env inside the test is enough.
const useTimeZone = (tz: string) => vi.stubEnv("TZ", tz);

afterEach(() => {
  vi.unstubAllEnvs();
});

const cleared = (dates: string[]): DrillProgressRecord[] =>
  dates.map((date, i) => ({
    id: i + 1,
    date,
    drillId: "zh-1",
    bestScore: 92,
    cleared: true,
    attempts: 1,
  }));

describe("computeStreak", () => {
  it("counts consecutive cleared days back from today", () => {
    useTimeZone("UTC");
    const records = cleared(["2026-06-10", "2026-06-11", "2026-06-12"]);
    expect(
      computeStreak(records, new Date("2026-06-12T09:00:00").getTime()),
    ).toBe(3);
  });

  it("does not let an uncleared today break yesterday’s streak", () => {
    useTimeZone("UTC");
    const records = cleared(["2026-06-10", "2026-06-11"]);
    expect(
      computeStreak(records, new Date("2026-06-12T09:00:00").getTime()),
    ).toBe(2);
  });

  it("stops at the first gap", () => {
    useTimeZone("UTC");
    const records = cleared(["2026-06-08", "2026-06-10", "2026-06-11"]);
    expect(
      computeStreak(records, new Date("2026-06-11T09:00:00").getTime()),
    ).toBe(2);
  });

  // The regression: walking back by a fixed 86_400_000ms near midnight skipped
  // 2026-03-08 (the 23h spring-forward day) and reported a broken streak.
  it.each(["America/Los_Angeles", "America/New_York"])(
    "survives the spring-forward boundary just after midnight in %s",
    (tz) => {
      useTimeZone(tz);
      const records = cleared([
        "2026-03-06",
        "2026-03-07",
        "2026-03-08", // 23-hour day
        "2026-03-09",
        "2026-03-10",
      ]);
      expect(
        computeStreak(records, new Date("2026-03-10T00:30:00").getTime()),
      ).toBe(5);
    },
  );

  it.each(["America/Los_Angeles", "America/New_York"])(
    "does not double-count the fall-back day in %s",
    (tz) => {
      useTimeZone(tz);
      const records = cleared([
        "2026-10-31",
        "2026-11-01",
        "2026-11-02",
        "2026-11-03",
      ]);
      expect(
        computeStreak(records, new Date("2026-11-03T00:30:00").getTime()),
      ).toBe(4);
    },
  );
});
