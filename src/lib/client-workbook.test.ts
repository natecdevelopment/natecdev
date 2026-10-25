import { describe, expect, it } from "vitest";
import { parseClientWorkbook } from "./client-workbook";
import type { Workbook } from "./xlsx-lite";

const serial = (iso: string) => (Date.parse(iso + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000;
const book = (sheets: Record<string, (string | number | null)[][]>): Workbook => ({ sheetNames: Object.keys(sheets), sheets });

describe("parseClientWorkbook", () => {
  it("joins Clients, Schedule and Payments by flat and skips empty rows", () => {
    const r = parseClientWorkbook(book({
      Clients: [["Project", "Flat", "Client name", "Phone", "Car parking", "Agreement date", "Total price"],
        ["Demo", "9z", "Test Client", "1712345678", "Yes", serial("2026-02-20"), 600000],
        ["Demo", "9Y", null, null, null, null, null]],
      Schedule: [["Project", "Flat", "Item", "No.", "Amount (BDT)", "Pay from", "Due date"],
        ["Demo", "9Z", "Booking money", null, 100000, null, null],
        ["Demo", "9Z", "Instalment", 1, 500000, null, serial("2026-06-05")]],
      Payments: [["Flat", "Paid on", "Amount", "Type", "Method"], ["9Z", "01/03/2026", 100000, "booking money", "bkash"]],
    }));
    expect(r.errors).toEqual([]);
    expect(r.clients.map((c) => c.flat)).toEqual(["9Z"]);
    const c = r.clients[0]!;
    expect(c.info).toMatchObject({ full_name: "Test Client", phone: "01712345678", parking: true, agreement_date: "2026-02-20", total_price: 600000 });
    expect(c.schedule?.total).toBe(600000);
    expect(c.payments).toEqual([{ paid_on: "2026-03-01", amount: 100000, type: "Booking money", method: "bKash", reference: "", note: "" }]);
    expect(c.problems).toEqual([]);
  });

  it("flags a total that does not match the schedule", () => {
    const r = parseClientWorkbook(book({
      Clients: [["Flat", "Total price"], ["1A", 900000]],
      Schedule: [["Flat", "Item", "No.", "Amount", "Due date"], ["1A", "Instalment", 1, 800000, serial("2026-01-05")]],
    }));
    expect(r.clients[0]!.problems.join(" ")).toMatch(/does not match/);
  });
});
