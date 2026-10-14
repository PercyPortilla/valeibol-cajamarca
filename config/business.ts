export const businessConfig = {
  slug: "valeibol-cajamarca",
  name: "Valeibol",
  shortName: "mi valeibol",
  category: "Club de voleibol",
  city: "Cajamarca",
  country: "Perú",
  address: "Jr. Guillermo Urrelo 1674, Cajamarca 06001",
  phone: "935 059 868",
  currency: "PEN",
  timezone: "America/Lima",
  pricing: {
    withoutLights: 35,
    withLights: 60,
  },
  availability: {
    /**
     * FALLBACK PROVISIONAL DE DESARROLLO.
     * Se usa únicamente cuando faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
     * NO representa el horario real confirmado del negocio.
     */
    scheduleSource: "mock-provisional",
    slotMinutes: 60,
    weeklySchedule: {
      monday: { enabled: true, opensAt: "08:00", closesAt: "23:00" },
      tuesday: { enabled: true, opensAt: "08:00", closesAt: "23:00" },
      wednesday: { enabled: true, opensAt: "08:00", closesAt: "23:00" },
      thursday: { enabled: true, opensAt: "08:00", closesAt: "23:00" },
      friday: { enabled: true, opensAt: "08:00", closesAt: "23:00" },
      saturday: { enabled: true, opensAt: "08:00", closesAt: "23:00" },
      sunday: { enabled: true, opensAt: "08:00", closesAt: "23:00" },
    },
  },
} as const;

export type BusinessConfig = typeof businessConfig;
