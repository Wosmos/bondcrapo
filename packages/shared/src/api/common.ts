import { z } from "zod";

export const API_PREFIX = "/api/v1";

export const errorCodeSchema = z.enum([
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "not_implemented",
  "unavailable",
  "internal",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** `{ error: { code, message } }`, the body of every non 2xx JSON response. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const HTTP_STATUS_FOR_ERROR: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  not_implemented: 501,
  unavailable: 503,
  internal: 500,
};

/** Wraps a data schema into the `{ data, meta }` success envelope. */
export function envelope<D extends z.ZodType, M extends z.ZodType = z.ZodType<Record<string, unknown>>>(
  data: D,
  meta?: M,
) {
  return z.object({
    data,
    meta: (meta ?? z.record(z.string(), z.unknown())).optional(),
  });
}

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const bondNumberSchema = z.string().regex(/^\d{6}$/, "expected exactly 6 digits");
export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, "expected ISO 4217 code");

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

export const pageMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export const cursorMetaSchema = z.object({
  nextCursor: z.string().nullable(),
});

export const emptyResponseSchema = z.object({ ok: z.literal(true) });
