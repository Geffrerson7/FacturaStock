import { ApiError } from "@/src/lib/api/errors";

/**
 * Límite de peticiones de ventana fija, guardado en memoria.
 *
 * Es por proceso: en un despliegue serverless cada instancia lleva su propia
 * cuenta, así que el límite real puede ser algo mayor. Basta para frenar el
 * abuso desde una sesión; para un límite exacto haría falta un almacén
 * compartido (Redis o una tabla).
 */

type Bucket = { count: number; resetAt: number };

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Segundos hasta que se reinicia la ventana. */
  retryAfter: number;
};

export function createRateLimiter(options: { limit: number; windowMs: number }) {
  const buckets = new Map<string, Bucket>();

  return function check(key: string, now: number = Date.now()): RateLimitResult {
    // Limpieza de ventanas vencidas para que el mapa no crezca sin límite.
    if (buckets.size > 1_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    return {
      allowed: bucket.count <= options.limit,
      remaining: Math.max(0, options.limit - bucket.count),
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  };
}

// Las consultas de DNI y RUC comparten cuota: 10 por minuto por usuario.
const checkDocumentLookup = createRateLimiter({ limit: 10, windowMs: 60_000 });

export function enforceDocumentLookupLimit(userId: string): void {
  const result = checkDocumentLookup(userId);

  if (!result.allowed) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `Demasiadas consultas. Inténtalo de nuevo en ${result.retryAfter} segundos.`,
      { details: { retryAfter: result.retryAfter } },
    );
  }
}
