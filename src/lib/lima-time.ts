/**
 * Fechas de calendario en la hora de Lima. Perú usa UTC-5 todo el año (no
 * tiene horario de verano), así que basta con un desfase fijo.
 */

export const LIMA_TIME_ZONE = "America/Lima";

const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha de calendario (AAAA-MM-DD) que marca el reloj en Lima. */
export function limaDateKey(date: Date): string {
  return new Date(date.getTime() + LIMA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Medianoche en Lima de una fecha AAAA-MM-DD. */
export function limaMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00-05:00`);
}

/** Inicio del día en Lima que contiene `date`. */
export function startOfLimaDay(date: Date): Date {
  return limaMidnight(limaDateKey(date));
}

/** Inicio del mes en Lima que contiene `date`. */
export function startOfLimaMonth(date: Date): Date {
  return limaMidnight(`${limaDateKey(date).slice(0, 7)}-01`);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
