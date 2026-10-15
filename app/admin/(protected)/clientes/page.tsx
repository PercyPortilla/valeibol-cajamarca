import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createPhase7Repository } from "@/lib/data/phase7Service";
import { Phase7RepositoryError } from "@/lib/data/repositories/phase7Repository";
import { formatAdminDateTime, formatMoney, lightingLabel, reservationStatusLabel, reservationStatusTone } from "@/lib/admin/reservations";
import { netHeightLabel } from "@/lib/booking";

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const context = await requireAdminContext();
  const { cliente } = await searchParams;
  const repository = createPhase7Repository({ local: isLocalDevAdminUserId(context.userId) });

  try {
    const customers = await repository.listCustomers(200);
    coonýïKh‘éì¶»§q«^u: 10px; }
.booking-error {
  padding: 12px 13px;
  border: 1px solid rgba(255,95,109,.24);
  border-radius: 12px;
  background: var(--red-soft);
  color: #ffb0b7;
  font-size: 12px;
}
.booking-policy { margin: -4px 0 0; color: #72889a; font-size: 10px; text-align: center; }
.button:disabled { opacity: .55; cursor: not-allowed; transform: none; }

.booking-result { padding: 30px 24px; text-align: center; }
.booking-result__icon {
  width: 54px;
  height: 54px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid rgba(45,156,255,.28);
  background: var(--blue-soft);
  color: #8dccff;
  font-size: 24px;
  font-weight: 900;
}
.booking-result__icon--success {
  border-color: rgba(48,209,123,.3);
  background: var(--green-soft);
  color: #72e7a7;
}
.booking-result h3 { margin: 0 0 10px; font-size: 28px; letter-spacing: -.035em; }
.booking-result p { margin: 8px auto; max-width: 540px; color: #9fb2c1; font-size: 13px; }
.booking-result .button { margin-top: 10px; }

@media (max-width: 640px) {
  .booking-dialog { width: min(100% - 16px, 680px); max-height: calc(100dvh - 16px); border-radius: 18px; }
  .booking-dialog__header { padding: 16px; }
  .booking-dialog__header h2 { font-size: 24px; }
  .booking-form { padding: 16px; gap: 15px; }
  .booking-summary { grid-template-columns: 1fr 1fr; }
  .booking-summary > div:first-child { grid-column: 1/-1; }
  .booking-summary--success { grid-template-columns: 1fr; }
  .booking-summary--success > div:first-child { grid-column: auto; }
  .booking-fields { grid-template-columns: 1fr; }
  .lighting-picker { grid-template-columns: 1fr; }
  .booking-result { padding: 26px 16px; }
  .court-picker { margin-inline: 12px; }
}

@media (max-width: 390px) {
  .booking-summary { grid-template-columns: 1fr; }
  .booking-summary > div:first-child { grid-column: auto; }
  .booking-dialog__header { align-items: flex-start; }
  .booking-quote__total span, .booking-quote__total strong { font-size: 16px; }
}

/* =========================================================
   FASE 5 â€” AUTH ADMINISTRATIVO Y DASHBOARD SEGURO
   ========================================================= */
.auth-notice,
.auth-error {
  margin-top: 18px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.45;
}
.auth-notice {
  border: 1px solid rgba(255,154,61,.28);
  background: rgba(255,122,26,.08);
  color: #ffd0aa;
}
.auth-notice--success {
  border-color: rgba(48,209,123,.28);
  background: var(--green-soft);
  color: #92efbb;
}
.auth-error {
  border: 1px solid rgba(255,95,109,.3);
  background: var(--red-soft);
  color: #ffb7bd;
}
.access-denied-actions { display: grid; gap: 10px; margin-top: 24px; }

.admin-shell { grid-template-columns: 274px minmax(0, 1fr); }
.admin-sidebar { z-index: 10; gap: 0; }
.admin-sidebar nav { gap: 6px; }
.admin-nav-item {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 720;
  white-space: nowrap;
}
.admin-nav-item:hover { color: #fff; background: rgba(255,255,255,.035); }
.admin-nav-item--active:hover { background: var(--blue-soft); }
.admin-account {
  margin-top: auto;
  padding: 14px 10px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--border);
}
.admin-account__avatar {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: var(--blue-soft);
  color: #9bd4ff;
  font-weight: 900;
}
.admin-account__meta { min-width: 0; display: grid; }
.admin-account__meta strong { overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
.admin-account__meta small { color: var(--muted); font-size: 10px; }
.admin-logout {
  min-height: 40px;
  margin: 5px 8px 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: #cad7e0;
  font-size: 12px;
  font-weight: 750;
}
.admin-logout:hover { border-color: rgba(255,95,109,.28); color: #ffb0b7; }
.admin-logout:focus-visible { outline: 3px solid rgba(45,156,255,.38); outline-offset: 3px; }
.admin-logout:disabled { opacity: .55; cursor: wait; }
.admin-exit { margin-top: 6px; }
.admin-subtitle { max-width: 720px; margin: 7px 0 0; color: var(--muted); font-size: 13px; }
.admin-status-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
.admin-status-card { min-height: 150px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; }
.admin-status-card > strong { margin: 10px 0; font-size: clamp(20px, 2.2vw, 30px); letter-spacing: -.035em; overflow-wrap: anywhere; }
.admin-status-card small { color: var(--muted); }
.admin-readonly-callout { display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.admin-readonly-callout h2 { margin: 10px 0 5px; }
.admin-readonly-callout p { max-width: 720px; margin: 0; color: var(--muted); }
.admin-pending-module { padding: 26px; max-width: 760px; }
.admin-pending-module h2 { margin: 14px 0 8px; font-size: 28px; letter-spacing: -.035em; }
.admin-pending-module p { color: var(--muted); }

.admin-reservation-list { display: grid; gap: 12px; }
.admin-reservation-card {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,.02), transparent), var(--surface);
}
.admin-reservation-card__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; }
.admin-reservation-card__head > div { display: grid; gap: 3px; }
.admin-reservation-card__head strong { font-size: 17px; text-transform: capitalize; }
.admin-reservation-card__head small { color: var(--muted); font-size: 11px; text-transform: capitalize; }
.admin-reservation-card__court { color: #8dccff; font-size: 11px; font-weight: 850; }
.admin-reservation-details {
  margin: 18px 0 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--border);
}
.admin-reservation-details > div { padding: 12px 14px; background: #0c1823; min-width: 0; }
.admin-reservation-details dt { color: var(--muted); font-size: 10px; }
.admin-reservation-details dd { margin: 4px 0 0; color: #eef6fb; font-size: 12px; font-weight: 800; overflow-wrap: anywhere; }
.admin-reservation-card__note { margin: 13px 0 0; color: #72889a; font-size: 10px; }

@media (max-width: 1100px) {
  .admin-shell { grid-template-columns: 220px minmax(0,1fr); }
  .admin-content { padding: 26px 22px; }
  .admin-reservation-details { grid-template-columns: repeat(2, minmax(0,1fr)); }
}

/* Reemplaza el colapso visual antiguo de Fase 1: en tablet el menÃº sigue siendo legible. */
@media (max-width: 960px) and (min-width: 641px) {
  .admin-shell { grid-template-columns: 200px minmax(0,1fr); }
  .admin-sidebar { padding-inline: 10px; }
  .brand--admin span:last-child { display: block; }
  .admin-nav-item { font-size: 12px; }
  .admin-nav-item::first-letter { font-size: inherit; }
  .admin-exit { font-size: 11px; }
  .admin-account__meta strong { max-width: 120px; }
  .admin-status-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .admin-shell { display: block; }
  .admin-sidebar {
    position: sticky;
    top: 0;
    height: auto;
    padding: 10px 12px;
    display: grid;
    grid-template-columns: auto minmax(0,1fr) auto;
    align-items: center;
    border-right: 0;
    border-bottom: 1px solid var(--border);
    background: rgba(9,19,29,.96);
    backdrop-filter: blur(14px);
  }
  .brand--admin { min-width: 42px; padding: 0; border: 0; }
  .brand--admin span:last-child { display: none; }
  .brand--admin .brand__mark { width: 38px; height: 38px; }
  .admin-sidebar nav {
    min-width: 0;
    margin: 0 8px;
    display: flex;
    gap: 5px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .admin-sidebar nav::-webkit-scrollbar { display: none; }
  .admin-nav-item { min-width: max-content; min-height: 38px; padding-inline: 11px; font-size: 11px; text-align: center; }
  .admin-account { display: none; }
  .admin-logout { min-height: 38px; margin: 0; padding: 0 10px; font-size: 10px; }
  .admin-exit { display: none; }
  .admin-content { padding: 22px 12px 36px; overflow: visible; }
  .admin-topbar { align-items: stretch; flex-direction: column; }
  .admin-topbar h1 { font-size: 30px; }
  .admin-status-grid { grid-template-columns: 1fr; }
  .admin-readonly-callout { align-items: stretch; flex-direction: column; }
  .admin-readonly-callout .button { width: 100%; }
  .admin-reservation-details { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 430px) {
  .auth-page { padding: 12px; }
  .auth-card { padding: 22px 18px; border-radius: 20px; }
  .auth-card__title h1 { font-size: 30px; }
  .admin-reservation-card { padding: 15px; }
  .admin-reservation-card__head { flex-direction: column; }
  .admin-reservation-details { grid-template-columns: 1fr; }
}

@media (max-width: 390px) {
  .admin-sidebar { grid-template-columns: auto minmax(0,1fr); }
  .admin-logout { grid-column: 1 / -1; width: 100%; margin-top: 8px; }
}

@media (max-width: 360px) {
  .admin-nav-item { padding-inline: 9px; font-size: 10px; }
  .admin-content { padding-inline: 10px; }
}

/* Fase 6 Â· pizarra administrativa operativa */
.admin-topbar--schedule { align-items: flex-start; }
.admin-topbar__badges { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.admin-dashboard-actions { display: grid; gap: 12px; }
.admin-week-navigation {
  display: grid;
  grid-template-columns: auto minmax(180px, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #0a1620;
}
.admin-week-navigation > div { display: grid; justify-items: center; gap: 2px; }
.admin-week-navigation > div strong { font-size: 14px; text-transform: capitalize; }
.admin-week-navigation > div small { color: var(--muted); font-size: 10px; }

.admin-schedule-app { display: grid; gap: 14px; }
.admin-schedule-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.admin-court-tabs, .admin-schedule-actions, .admin-schedule-legend { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.admin-court-tab {
  min-height: 38px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #0b1823;
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}
.admin-court-tab--active { border-color: rgba(45,156,255,.42); background: var(--blue-soft); color: #fff; }
.admin-schedule-legend { padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: #09141e; }
.admin-schedule-legend span { display: inline-flex; align-items: center; gap: 6px; color: #8ea2b4; font-size: 10px; font-weight: 750; }
.admin-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #657483; }
.admin-status-dot--available { background: #2edb8e; }
.admin-status-dot--pending { background: #ffb84d; }
.admin-status-dot--confirmed { background: #2d9cff; }
.admin-status-dot--blocked { background: #ff6678; }
.admin-status-dot--completed { background: #a57cff; }
.admin-status-dot--unavailable { background: #647482; }

.admin-week-board {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 7px;
  min-width: 0;
}
.admin-day-column { min-width: 0; border: 1px solid var(--border); border-radius: 14px; background: #09151f; overflow: hidden; }
.admin-day-column__header { min-height: 84px; padding: 12px 10px; display: grid; align-content: center; gap: 3px; border-bottom: 1px solid var(--border); background: #0b1925; }
.admin-day-column__header strong { text-transform: uppercase; color: #91d0ff; font-size: 11px; letter-spacing: .08em; }
.admin-day-column__header span { font-size: 16px; font-weight: 900; text-transform: capitalize; }
.admin-day-column__header small { color: var(--muted); font-size: 8px; line-height: 1.3; }
.admin-day-column__slots { display: grid; gap: 5px; padding: 6px; }
.admin-day-closed { min-height: 160px; display: grid; place-items: center; padding: 15px; color: var(--muted); font-size: 10px; text-align: center; }

.admin-slot { min-width: 0; padding: 8px; border: 1px solid rgba(255,255,255,.06); border-radius: 10px; background: #0c1822; }
.admin-slot--available { border-color: rgba(46,219,142,.18); background: rgba(46,219,142,.055); }
.admin-slot--pending { border-color: rgba(255,184,77,.3); background: rgba(255,184,77,.08); }
.admin-slot--confirmed { border-color: rgba(45,156,255,.3); background: rgba(45,156,255,.08); }
.admin-slot--blocked { border-color: rgba(255,102,120,.3); background: rgba(255,102,120,.075); }
.admin-slot--completed { border-color: rgba(165,124,255,.26); background: rgba(165,124,255,.07); }
.admin-slot--unavailable { opacity: .65; background: #09131c; }
.admin-slot__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 5px; }
.admin-slot__head span { color: #e9f5fc; font-size: 9px; font-weight: 850; white-space: nowrap; }
.admin-slot__head b { color: #87a0b4; font-size: 8px; line-height: 1.2; text-align: right; }
.admin-slot--pending .admin-slot__head b { color: #ffd392; }
.admin-slot--confirmed .admin-slot__head b { color: #80c7ff; }
.admin-slot--blocked .admin-slot__head b { color: #ff9eaa; }
.admin-slot__entry { display: grid; gap: 3px; margin-top: 7px; }
.admin-slot__entry strong { font-size: 9px; color: #f3f8fb; overflow-wrap: anywhere; }
.admin-slot__entry small { color: #8298aa; font-size: 8px; line-height: 1.25; overflow-wrap: anywhere; }
.admin-slot__actions, .admin-slot__quick-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.admin-mini-action, .admin-slot__quick-actions button {
  min-height: 26px;
  padding: 0 7px;
  border: 1px solid rgba(45,156,255,.24);
  border-radius: 7px;
  background: rgba(45,156,255,.08);
  color: #b9ddf8;
  font: inherit;
  font-size: 8px;
  font-weight: 850;
  cursor: pointer;
}
.admin-mini-action--danger { border-color: rgba(255,102,120,.28); background: rgba(255,102,120,.08); color: #ffabb5; }
.admin-mini-action:disabled, .admin-slot__quick-actions button:disabled { opacity: .5; cursor: wait; }
.admin-slot__released { display: block; margin-top: 5px; color: #6f8394; font-size: 7px; }

.admin-mobile-days, .admin-mobile-slot-list { display: none; }
.admin-feedback { padding: 11px 13px; border-radius: 10px; font-size: 11px; font-weight: 750; }
.admin-feedback--success { border: 1px solid rgba(46,219,142,.28); background: rgba(46,219,142,.08); color: #9cf0c8; }
.admin-feedback--error { border: 1px solid rgba(255,102,120,.28); background: rgba(255,102,120,.08); color: #ffb1ba; }
.admin-reservation-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
