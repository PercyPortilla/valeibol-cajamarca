"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { schedulePricingRuleAction, type AdminActionResult } from "@/app/admin/(protected)/actions";
import type { AdminRole } from "@/lib/auth";
import { canPerformPhase7Operation, lightingModeLabel, type AdminPricingRule } from "@/lib/admin/phase7";

export function AdminPricingForm({ rules, role }: { rules: AdminPricingRule[]; role: AdminRole }) {
  const courts = useMemo(() => {
    const map = new Map<string, string>();
    rules.forEach((rule) => map.set(rule.courtId, rule.courtName));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rules]);
  const firstCourt = courts[0]?.id ?? "";
  const today = rules[0]?.businessToday ?? "";
  const currency = rules[0]?.currency ?? "PEN";
  const [courtId, setCourtId] = useState(firstCourt);
  const [lighting, setLighting] = useState<"without_lights" | "with_lights">("without_lights");
  const [hourlyRate, setHourlyRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const canManage = canPerformPhase7Operation(role, "manage_pricing");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    const parsed = Number(hourlyRate);
    startTransition(async () => {
      const next = await schedulePricingRuleAction({ courtId, lighting, hourlyRate: parsed, effectiveFrom });
      setResult(next);
      if (next.ok) setHourlyRate("");
    });
  }

  if (!canManage) {
    return (
      <div className="phase7-permission-note" role="note">
        <strong>Solo lectura</strong>
        <span>Tu rol puede consultar tarifas, pero solo owner y admin pueden programar cambios.</span>
      </div>
    );
  }

  if (courts.length === 0) return null;

  return (
    <form className="phase7-pricing-form" onSubmit={submit}>
      <div className="phase7-form-grid">
        <label className="field">
          <span className="field__label">Cancha</span>
          <select className="field__control" value={courtId} onChange={(event) => setCourtId(event.target.value)}>
            {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Modalidad</span>
          <select className="field__control" value={lighting} onChange={(event) => setLighting(event.target.value as typeof lighting)}>
            <option value="without_lights">{lightingModeLabel("without_lights")}</option>
            <option value="with_lights">{lightingModeLabel("with_lights")}</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Nueva tarifa por hora ({currency})</span>
          <input className="field__control" type="number" min="0.01" max="10000" step="0.01" inputMode="decimal" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">Vigente desde</span>
          <input className="field__control" type="date" min={today} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required />
        </label>
      </div>
      <p className="phase7-form-help">Se crea una nueva versión. La regla anterior se cierra temporalmente; ninguna reserva existente cambia su hourly_rate ni total_amount guardados.</p>
      {result ? <div className={result.ok ? "admin-action-message admin-action-message--success" : "admin-action-message admin-action-message--error"} role={result.ok ? "status" : "alert"}>{result.message}</div> : null}
      <button className="button button--primary" type="submit" disabled={pending || !courtId || !hourlyRate || !effectiveFrom}>
        {pending ? "Validando y guardando…" : "Programar nueva tarifa"}
      </button>
    </form>
  );
}
