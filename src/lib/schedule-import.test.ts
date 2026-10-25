import { describe, expect, it } from "vitest";
import { buildAgreementRows, parseScheduleWorkbook } from "./schedule-import";
import type { Workbook } from "./xlsx-lite";

const serial = (iso: string) => (Date.parse(iso + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000;
const wb = (rows: (string | number | null)[][], summary?: (string | number | null)[][]): Workbook => ({
  sheetNames: summary ? ["Summary", "Schedule"] : ["Schedule"],
  sheets: { Schedule: rows, ...(summary ? { Summary: summary } : {}) },
});
const HEAD = ["Project", "Flat", "Item", "No.", "Amount (BDT)", "Pay from", "Due date"];

describe("parseScheduleWorkbook", () => {
  it("groups rows by flat and reads Excel date serials", () => {
    const r = parseScheduleWorkbook(wb([
      ["Natec agreement schedules"], HEAD,
      ["Demo", "9z", "Booking money", null, 100000, null, null],
      ["Demo", "9Z", "Down payment", null, "5,00,000", null, null],
      ["Demo", "9Z", "Instalment", 1, 200000, serial("2026-05-25"), serial("2026-06-05")],
      ["Demo", "9Z", "Instalment", 2, 200000, serial("2026-07-25"), "05/08/2026"],
    ], [["Flat", "Agreement date"], ["9Z", serial("2026-02-20")]]));
    expect(r.errors).toEqual([]);
    expect(r.plans).toHaveLength(1);
    const p = r.plans[0]!;
    expect(p.flat).toBe("9Z");
    expect(p.total).toBe(1000000);
    expect(p.agreementDate).toBe("2026-02-20");
    expect(p.rows.map((x) => x.due)).toEqual([null, null, "2026-06-05", "2026-08-05"]);
    expect(p.problems).toEqual([]);
  });

  it("flags missing due dates and bad numbering", () => {
    const p = parseScheduleWorkbook(wb([HEAD,
      ["", "1X", "Instalment", 1, 1000, null, null],
      ["", "1X", "Instalment", 3, 1000, null, serial("2026-01-01")],
    ])).plans[0]!;
    expect(p.problems.join(" ")).toMatch(/Instalment 1 has no due date/);
    expect(p.problems.join(" ")).toMatch(/numbered 1, 2, 3/);
  });
});

describe("buildAgreementRows", () => {
  it("puts booking/down first, labels instalments and reuses ids that still cover what was paid", () => {
    const plan = parseScheduleWorkbook(wb([HEAD,
      ["", "9Z", "Booking money", null, 100000, null, null],
      ["", "9Z", "Down payment", null, 500000, null, null],
      ["", "9Z", "Instalment", 1, 250000, null, serial("2026-06-05")],
      ["", "9Z", "Instalment", 2, 50000, null, serial("2026-08-05")],
    ])).plans[0]!;
    const rows = buildAgreementRows(plan, [
      { id: "b", label: "Booking money", due_date: "2026-10-21", amount: 100000, paid: 100000 },
      { id: "i1", label: "Instalment 1 of 24", due_date: "2026-01-25", amount: 250000, paid: 140000 },
      { id: "i2", label: "Instalment 2 of 24", due_date: "2026-04-25", amount: 200000, paid: 60000 },
    ], "2026-01-10");
    expect(rows.map((r) => r.label)).toEqual(["Booking money", "Down payment", "Instalment 1 of 2", "Instalment 2 of 2"]);
    expect(rows[0]!.due_date).toBe("2026-01-10");
    expect(rows[1]!.due_date <= rows[2]!.due_date).toBe(true);
    expect(rows.map((r) => r.id)).toEqual(["b", undefined, "i1", undefined]); // i2 paid 60k > new 50k → new row
  });
});
