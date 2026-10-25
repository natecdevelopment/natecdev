import { describe, expect, it } from "vitest";
import { allocatePayment, generateSchedule, lateFee, taka, totalLateFee } from "./money";

describe("money rules", () => {
  it("formats taka with lakh grouping", () => expect(taka(1250000)).toBe("৳ 12,50,000"));
  it("formats crore", () => expect(taka(12500000)).toBe("৳ 1,25,00,000"));
  it("schedule always adds up to the total price", () => {
    const rows = generateSchedule({ total: 5000000, booking: 200000, down: 800000, count: 24, frequency: "monthly", firstDue: "2026-11-05", bookingDate: "2026-10-21" });
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(5000000);
    expect(rows).toHaveLength(26);
    expect(rows[2]!.label).toBe("Instalment 1 of 24");
    expect(rows[3]!.due_date).toBe("2026-12-05");
  });
  it("quarterly steps three months", () => {
    const rows = generateSchedule({ total: 300, booking: 0, down: 0, count: 3, frequency: "quarterly", firstDue: "2026-01-31" });
    expect(rows.map((r) => r.due_date)).toEqual(["2026-01-31", "2026-04-30", "2026-07-31"]);
  });
  it("payment is applied to the oldest unpaid instalments first", () => {
    const r = allocatePayment([
      { id: "b", due_date: "2026-02-01", amount: 100, paid_amount: 0 },
      { id: "a", due_date: "2026-01-01", amount: 100, paid_amount: 60 },
    ], 90);
    expect(r.allocations).toEqual([{ id: "a", apply: 40 }, { id: "b", apply: 50 }]);
    expect(r.unapplied).toBe(0);
  });
});

import { computePlan, type PlanForm } from "./money";
const base: PlanForm = { total: 758242, booking: 54444, count: 24, freqMonths: 3, firstDue: "2026-11-01", instAmount: 25000, downManual: null, downDue: "", round: 1000 };
describe("payment plan builder", () => {
  it("instalment amount given → down payment is the rest (user example)", () => {
    const r = computePlan(base, "2026-10-01");
    expect(r.down).toBe(103798);
    expect(r.rows.reduce((s, x) => s + x.amount, 0)).toBe(758242);
    expect(r.rows[1]).toEqual({ due_date: "2026-10-31", amount: 103798, label: "Down payment" });
    expect(r.rows[3]!.due_date).toBe("2027-02-01");
  });
  it("instalments too big → blocking error", () => {
    expect(computePlan({ ...base, instAmount: 40000 }, "2026-10-01").errors.instAmount).toMatch(/more than the price/);
  });
  it("no instalment amount → down 0, rounded down, last absorbs", () => {
    const r = computePlan({ ...base, instAmount: null }, "2026-10-01");
    expect(r.down).toBe(0); expect(r.each).toBe(29000); expect(r.last).toBe(703798 - 29000 * 23);
    expect(r.rows.reduce((s, x) => s + x.amount, 0)).toBe(758242);
  });
  it("manual down payment → reverse mode", () => {
    const r = computePlan({ ...base, instAmount: null, downManual: 103798 }, "2026-10-01");
    expect(r.each).toBe(25000); expect(r.last).toBe(25000);
  });
  it("31st clamps to month end", () => {
    const r = computePlan({ ...base, firstDue: "2027-01-31", freqMonths: 1, instAmount: null }, "2026-10-01");
    expect(r.rows[1]!.due_date).toBe("2027-01-31"); expect(r.rows[2]!.due_date).toBe("2027-02-28");
  });
});

import { rebuildKeepingPaid as _rk } from "./money";
describe("rebuildKeepingPaid", () => {
  it("keeps paid rows and spreads the rest over new unpaid rows", () => {
    const current = [
      { id: "a", due_date: "2026-01-01", amount: 50000, label: "Booking money", paid: 50000 },
      { id: "b", due_date: "2026-02-01", amount: 30000, label: "Instalment 1 of 10", paid: 10000 },
      { id: "c", due_date: "2026-03-01", amount: 30000, label: "Instalment 2 of 10", paid: 0 },
    ];
    const plan = { total: 500000, booking: 50000, count: 4, freqMonths: 3 as const, firstDue: "2026-04-01", instAmount: null, downManual: null, downDue: "2026-01-31", round: 1000 as const };
    const out = _rk(plan, "2026-01-01", current);
    expect(out.filter((r) => r.id).map((r) => r.id)).toEqual(["a", "b"]);
    const fresh = out.filter((r) => !r.id);
    expect(fresh).toHaveLength(4);
    expect(fresh.reduce((s, r) => s + r.amount, 0)).toBe(420000);
    expect(out.reduce((s, r) => s + r.amount, 0)).toBe(500000);
  });
});

describe("lateFee", () => {
  const row = { label: "Instalment 1 of 24", due_date: "2026-06-05", amount: 250000, paid_amount: 0 };
  it("charges 0.06% of the amount per day once the due date has passed and nothing is paid", () => {
    expect(lateFee(row, "2026-06-05")).toEqual({ days: 0, fee: 0 });
    expect(lateFee(row, "2026-06-15")).toEqual({ days: 10, fee: 1500 });
  });
  it("stops when any amount has been paid, and never applies to up-front items", () => {
    expect(lateFee({ ...row, paid_amount: 1000 }, "2026-07-01").fee).toBe(0);
    expect(lateFee({ ...row, label: "Down payment" }, "2027-01-01").fee).toBe(0);
    expect(totalLateFee([row, { ...row, due_date: "2026-06-10" }], "2026-06-15")).toBe(1500 + 750);
  });
});
