import { handleApiError } from "@/src/lib/api/errors";
import { parseSearchParams } from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { getCompanyInfo } from "@/src/lib/company";
import { buildKardexWorkbook, kardexFileName } from "@/src/lib/kardex/excel";
import { getKardexReport } from "@/src/lib/kardex/query";
import { kardexExportQuerySchema } from "@/src/lib/validations/kardex";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Kárdex de un producto en Excel, con el modo (físico o valorizado) y el
 * rango de la pantalla. El archivo se genera en memoria.
 *
 * Runtime: esta ruta corre en Node.js, que ExcelJS necesita. No se declara
 * `export const runtime = "nodejs"` porque con `cacheComponents` activado
 * Next 16 rechaza esa opción en el build ("Route segment config "runtime" is
 * not compatible with nextConfig.cacheComponents"): Cache Components ya usa
 * siempre el runtime de Node.js. Ver
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md
 */
export async function GET(request: Request) {
  try {
    await requireSession(request);

    const { mode, ...query } = parseSearchParams(
      request,
      kardexExportQuerySchema,
    );
    // Antes de consultar: si falta la configuración, falla sin gastar la base.
    const company = getCompanyInfo();
    const { report } = await getKardexReport(query);

    const workbook = buildKardexWorkbook(report, company, mode);
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = kardexFileName(report, mode);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
