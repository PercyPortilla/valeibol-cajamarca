import assert from "node:assert/strict";
import test from "node:test";
import { buildExportCustomers, sanitizeExcelText, type ExportReservation } from "../lib/admin/export.ts";
import { buildXlsxWorkbook } from "../lib/admin/xlsx.ts";

test("neutraliza texto que Excel podría interpretar como fórmula", () => {
  assert.equal(sanitizeExcelText("=HYPERLINK(\"https://example.com\")"), "'=HYPERLINK(\"https://example.com\")");
  assert.equal(sanitizeExcelText("+51935059868"), "'+51935059868");
  assert.equal(sanitizeExcelText("@SUM(A1:A2)"), "'@SUM(A1:A2)");
  assert.equal(sanitizeExcelText("Cliente normal"), "Cliente normal");
});

test("genera un XLSX OOXML válido sin depender de librerías externas", () => {
  const workbook = buildXlsxWorkbook([
    {
      name: "Resumen",
      rows: [
        ["Concepto", "Valor"],
        ["Nota", sanitizeExcelText("=SUM(A1:A2)")],
      ],
      freezeHeader: true,
      autoFilter: true,
    },
  ]);
  assert.deepEqual(Array.from(workbook.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  const raw = Buffer.from(workbook).toString("utf8");
  assert.match(raw, /xl\/workbook\.xml/);
  assert.match(raw, /Resumen/);
  assert.match(raw, /&apos;=SUM\(A1:A2\)/);
});

test("hoja Clientes deriva métricas de reservas sin confundir valor con cobros", () => {
  const base: ExportReservation = {
    id: "r1",
    customerId: "c1",
    customerName: "Ana",
    customerPhoneE164: "+51911111111",
    marketingOptIn: false,
    courtId: "court",
    courtName: "Cancha",
    startAt: "2026-10-20T23:00:00.000Z",
    endAt: "2026-10-21T00:00:00.000Z",
    status: "confirmed",
    lighting: "with_lights",
    netHeightCm: 243,
    hourlyRate: 60,
    totalAmount: 60,
    currency: "PEN",
    source: "admin",
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
  };
  const customers = buildExportCustomers([
    base,
    { ...base, id: "r2", status: "completed", totalAmount: 120, startAt: "2026-10-22T23:00:00.000Z" },
  ]);
  assert.equal(customers.length, 1);
  assert.equal(customers[0]?.reservationCount, 2);
  assert.equal(customers[0]?.confirmedValue, 60);
  assert.equal(customers[0]?.completedValue, 120);
});
