import assert from "node:assert/strict";
import test from "node:test";
import { addDays, businessTodayDateKey } from "../lib/availability.ts";
import { LocalAdminOperationsRepository } from "../lib/data/repositories/localAdminOperationsRepository.ts";
import { LocalAdminReservationRepository } from "../lib/data/repositories/localAdminReservationRepository.ts";
import { LocalPhase7Repository } from "../lib/data/repositories/localPhase7Repository.ts";
import {
  LOCAL_COURT_ID,
  resetLocalAdminStateForTests,
} from "../lib/data/localAdminStore.ts";

test("modo local alimenta dashboard, reservas, agenda, clientes y precios sin Supabase", async () => {
  resetLocalAdminStateForTests();
  const today = businessTodayDateKey();
  const tomorrow = addDays(today, 1);
  const reservations = new LocalAdminReservationRepository();
  const operations = new LocalAdminOperationsRepository();
  const phase7 = new LocalPhase7Repository();

  assert.ok((await reservations.list()).length >= 3);
  const schedule = await operations.getSchedule(today, addDays(today, 6), "America/Lima");
  assert.equal(schedule.courts[0]?.courtId, LOCAL_COURT_ID);
  assert.equal(schedule.courts[0]?.days.length, 7);
  assert.ok((await phase7.listCustomers()).length >= 2);
  assert.equal((await phase7.listPricingRules()).filter((rule) => rule.isCurrent).length, 2);
  const metrics = await phase7.getOperationalMetrics(today, addDays(today, 6));
  assert.ok(metrics.reservationCount >= 2);
  assert.ok(metrics.openCapacityHours > 0);

  const confirmed = await operations.confirmReservation("30000000-0000-4000-8000-000000000002");
  assert.equal(confirmed.status, "confirmed");

  const manual = await operations.createManualReservation({
    courtId: LOCAL_COURT_ID,
    date: addDays(tomorrow, 1),
    startTime: "10:00",
    endTime: "11:00",
    netHeightCm: 224,
    customerName: "Cliente Local",
    phoneE164: "+51911111111",
    source: "admin",
  });
  assert.equal(manual.status, "confirmed");
  assert.equal(manual.totalAmount, 35);

  const edited = await operations.editReservation({
    reservationId: manual.reservationId,
    courtId: LOCAL_COURT_ID,
    date: addDays(tomorrow, 1),
    startTime: "18:00",
    endTime: "19:00",
    netHeightCm: 243,
    customerName: "Cliente Local Editado",
    phoneE164: "+51911111111",
  });
  assert.equal(edited.totalAmount, 60);
  assert.equal(edited.lighting, "with_lights");
  assert.equal(edited.netHeightCm, 243);

  await assert.rejects(
    operations.createManualReservation({
      courtId: LOCAL_COURT_ID,
      date: addDays(tomorrow, 1),
      startTime: "17:00",
      endTime: "19:00",
      netHeightCm: 235,
      customerName: "Cruce no permitido",
      phoneE164: "+51922222222",
      source: "admin",
    }),
    /18:00/,
  );

  const block = await operations.createScheduleBlock({
    courtId: LOCAL_COURT_ID,
    date: addDays(tomorrow, 1),
    startTime: "12:00",
    endTime: "13:00",
    reason: "event",
    internalNote: "Prueba local",
  });
  assert.equal(block.status, "active");
  assert.equal((await operations.unblock(block.blockId)).status, "cancelled");
  assert.equal((await operations.cancelReservation(manual.reservationId)).status, "cancelled");

  const archived = await operations.archiveCancelledReservation(manual.reservationId);
  assert.ok(archived.archivedAt);
  assert.equal((await operations.archiveCancelledReservation(manual.reservationId)).archivedAt, archived.archivedAt);
  assert.equal((await reservations.list()).some((item) => item.id === manual.reservationId), false);
  assert.equal((await reservations.list(100, true)).find((item) => item.id === manual.reservationId)?.archivedAt, archived.archivedAt);

  const restored = await operations.restoreArchivedReservation(manual.reservationId);
  assert.equal(restored.archivedAt, null);
  assert.equal((await operations.restoreArchivedReservation(manual.reservationId)).archivedAt, null);
  assert.equal((await reservations.list()).some((item) => item.id === manual.reservationId), true);
});

test("modo local permite programar tarifa futura sin alterar producción", async () => {
  resetLocalAdminStateForTests();
  const phase7 = new LocalPhase7Repository();
  const effectiveFrom = addDays(businessTodayDateKey(), 3);
  const created = await phase7.schedulePricingRule({
    courtId: LOCAL_COURT_ID,
    lighting: "without_lights",
    hourlyRate: 40,
    effectiveFrom,
  });
  assert.equal(created.hourlyRate, 40);
  assert.equal(created.effectiveFrom, effectiveFrom);
  const future = (await phase7.listPricingRules()).find((rule) => rule.id === created.id);
  assert.equal(future?.hourlyRate, 40);
  assert.equal(future?.isCurrent, false);
});
