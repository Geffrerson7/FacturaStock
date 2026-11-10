import { Prisma } from "@/src/generated/prisma/client";

type ErrorExtra = {
  details?: unknown;
  field?: string;
};

export type ConflictOptions = {
  code: string;
  entity: string;
  fields: string[];
};

const DEFAULT_CONFLICT: ConflictOptions = {
  code: "CUSTOMER_ALREADY_EXISTS",
  entity: "customer",
  fields: ["dni", "ruc", "email"],
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly field?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    extra: ErrorExtra = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = extra.details;
    this.field = extra.field;
  }
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: ErrorExtra = {},
) {
  return Response.json(
    { error: { code, message, ...extra } },
    { status },
  );
}

function conflictField(
  error: Prisma.PrismaClientKnownRequestError,
  fields: string[],
) {
  const target = error.meta?.target;
  const fromMeta = Array.isArray(target)
    ? target.map(String)
    : typeof target === "string"
      ? [target]
      : [];
  const constraint =
    error.message.match(/constraint: `([^`]+)`/)?.[1] ?? "";
  const sources = [...fromMeta, constraint].filter(Boolean);

  return fields.find((candidate) =>
    sources.some((value) => value.toLowerCase().includes(candidate)),
  );
}

export function handleApiError(
  error: unknown,
  conflict: ConflictOptions = DEFAULT_CONFLICT,
): Response {
  if (error instanceof ApiError) {
    return errorResponse(error.status, error.code, error.message, {
      details: error.details,
      field: error.field,
    });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const field = conflictField(error, conflict.fields);

    return errorResponse(
      409,
      conflict.code,
      field
        ? `A ${conflict.entity} with that ${field} already exists.`
        : `A ${conflict.entity} with those unique values already exists.`,
      { field },
    );
  }

  console.error("[api] Unhandled error:", error);

  return errorResponse(
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred.",
  );
}
