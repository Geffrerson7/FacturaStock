import { handleApiError } from "@/src/lib/api/errors";
import {
  paginationMeta,
  parseJsonBody,
  parseSearchParams,
} from "@/src/lib/api/request";
import { requireSession } from "@/src/lib/api/session";
import { recordMovement } from "@/src/lib/kardex/engine";
import { getKardexReport, MOVEMENT_SELECT } from "@/src/lib/kardex/query";
import { prisma } from "@/src/lib/prisma";
import {
  createMovementSchema,
  kardexQuerySchema,
} from "@/src/lib/validations/kardex";

/** Kárdex de un producto: saldo anterior, movimientos paginados y totales. */
export async function GET(request: Request) {
  try {
    await requireSession(request);

    const query = parseSearchParams(request, kardexQuerySchema);
    const { report, total } = await getKardexReport(query);

    return Response.json(
      { data: report, pagination: paginationMeta(total, query) },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Movimiento manual: ingreso de mercadería, ajuste positivo o negativo,
 * merma o ajuste de valorización. El motivo es obligatorio.
 */
export async function POST(request: Request) {
  try {
    const user = await requireSession(request);
    const data = await parseJsonBody(request, createMovementSchema);

    const movement = await prisma.$transaction(async (tx) => {
      const created = await recordMovement(tx, {
        productId: data.productId,
        type: data.type,
        quantity: data.quantity ?? 0,
        unitCost: data.unitCost,
        referenceType: "MANUAL",
        reason: data.reason,
        userId: user.id,
      });

      return tx.stockMovement.findUniqueOrThrow({
        where: { id: created.id },
        select: MOVEMENT_SELECT,
      });
    });

    return Response.json({ data: movement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
