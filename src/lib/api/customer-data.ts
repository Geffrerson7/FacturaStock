import type { Prisma } from "@/src/generated/prisma/client";
import { WALK_IN_DNI } from "@/src/lib/customer";
import type {
  CreateCustomerInput,
  ListCustomersQuery,
} from "@/src/lib/validations/customer";
import { searchTokens } from "@/src/lib/validations/list";

/**
 * Un cliente es persona (DNI) o empresa (RUC). Los campos del otro tipo se
 * limpian explícitamente para que el PUT no deje datos mezclados.
 */
export function normalizeCustomerData(
  data: CreateCustomerInput,
): Prisma.CustomerUncheckedCreateInput {
  if (data.documentType === "RUC") {
    return {
      documentType: data.documentType,
      ruc: data.ruc,
      businessName: data.businessName,
      dni: null,
      firstName: null,
      lastName: null,
      address: data.address,
      phone: data.phone,
      email: data.email,
    };
  }

  return {
    documentType: data.documentType,
    dni: data.dni,
    firstName: data.firstName,
    lastName: data.lastName,
    ruc: null,
    businessName: null,
    address: data.address,
    phone: data.phone,
    email: data.email,
  };
}

/** Campos en los que se busca cada palabra de la búsqueda de clientes. */
export function customerTextFilters(token: string): Prisma.CustomerWhereInput[] {
  const contains = { contains: token, mode: "insensitive" as const };

  return [
    { firstName: contains },
    { lastName: contains },
    { businessName: contains },
    { dni: contains },
    { ruc: contains },
    { email: contains },
  ];
}

/**
 * Excluye al cliente walk-in. Hace falta el `dni: null` explícito: en SQL,
 * `dni <> '00000000'` descarta también las filas sin DNI (las empresas).
 */
export const NOT_WALK_IN: Prisma.CustomerWhereInput = {
  OR: [{ dni: null }, { dni: { not: WALK_IN_DNI } }],
};

export function buildCustomerWhere({
  q,
  documentType,
}: Pick<ListCustomersQuery, "q" | "documentType">): Prisma.CustomerWhereInput {
  return {
    AND: [
      NOT_WALK_IN,
      ...(documentType ? [{ documentType }] : []),
      ...searchTokens(q).map((token) => ({ OR: customerTextFilters(token) })),
    ],
  };
}

export function buildCustomerOrderBy({
  sort,
  order,
}: Pick<
  ListCustomersQuery,
  "sort" | "order"
>): Prisma.CustomerOrderByWithRelationInput[] {
  const by = { sort: order, nulls: "last" as const };

  switch (sort) {
    case "name":
      // Personas por apellido y nombre; empresas por razón social.
      return [
        { lastName: by },
        { firstName: by },
        { businessName: by },
        { id: order },
      ];
    case "document":
      return [{ dni: by }, { ruc: by }, { id: order }];
    default:
      return [{ createdAt: order }, { id: order }];
  }
}
