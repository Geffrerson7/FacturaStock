import { z } from "zod";

import { ApiError } from "@/src/lib/api/errors";

/**
 * Datos de la empresa para las cabeceras de los reportes (kárdex, Formato
 * 13.1). Hoy salen de variables de entorno; si mañana pasan a una tabla de
 * configuración, solo cambia este archivo.
 */
export type CompanyInfo = {
  ruc: string;
  businessName: string;
  /** Código y dirección del establecimiento, como texto libre. */
  establishment: string;
};

/** Valores de desarrollo. Nunca se usan en producción. */
export const DEV_COMPANY_INFO: CompanyInfo = {
  ruc: "20000000001",
  businessName: "FacturaStock Demo S.A.C.",
  establishment: "0000 - Domicilio fiscal",
};

const companySchema = z.object({
  ruc: z
    .string("Falta COMPANY_RUC.")
    .trim()
    .regex(/^(10|15|16|17|20)\d{9}$/, "COMPANY_RUC debe ser un RUC de 11 dígitos."),
  businessName: z
    .string("Falta COMPANY_BUSINESS_NAME.")
    .trim()
    .min(1, "Falta COMPANY_BUSINESS_NAME.")
    .max(160, "COMPANY_BUSINESS_NAME no puede superar los 160 caracteres."),
  establishment: z
    .string("Falta COMPANY_ESTABLISHMENT.")
    .trim()
    .min(1, "Falta COMPANY_ESTABLISHMENT.")
    .max(200, "COMPANY_ESTABLISHMENT no puede superar los 200 caracteres."),
});

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Lee y valida los datos de la empresa. En desarrollo y en los tests, una
 * variable ausente toma el valor de `DEV_COMPANY_INFO`. En producción, una
 * variable ausente o inválida es un error: un reporte contable con datos de
 * prueba es peor que ningún reporte.
 */
export function getCompanyInfo(): CompanyInfo {
  const isProduction = process.env.NODE_ENV === "production";
  const fallback = (key: keyof CompanyInfo) =>
    isProduction ? undefined : DEV_COMPANY_INFO[key];

  const result = companySchema.safeParse({
    ruc: readEnv("COMPANY_RUC") ?? fallback("ruc"),
    businessName: readEnv("COMPANY_BUSINESS_NAME") ?? fallback("businessName"),
    establishment:
      readEnv("COMPANY_ESTABLISHMENT") ?? fallback("establishment"),
  });

  if (!result.success) {
    throw new ApiError(
      500,
      "COMPANY_NOT_CONFIGURED",
      `Los datos de la empresa no están configurados: ${result.error.issues
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  return result.data;
}
