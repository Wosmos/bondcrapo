import { z } from "zod";
import { DENOMINATION_CODES, MAX_CHECK_NUMBERS } from "../constants";
import {
  bondNumberSchema,
  cursorMetaSchema,
  isoDateSchema,
  isoDateTimeSchema,
  pageMetaSchema,
  pageQuerySchema,
} from "./common";
import { defineEndpoint } from "./endpoint";

export const denominationCodeSchema = z.enum(DENOMINATION_CODES);
export const drawStatusSchema = z.enum(["scheduled", "published", "verified", "disputed"]);
export const completenessSchema = z.enum(["none", "top", "full"]);
export const tierSchema = z.number().int().min(1).max(3);

export const denominationSchema = z.object({
  code: z.string(),
  faceValue: z.number().int(),
  kind: z.enum(["bearer", "premium_registered"]),
  status: z.enum(["active", "discontinued"]),
  introducedOn: isoDateSchema.nullable(),
  discontinuedOn: isoDateSchema.nullable(),
  encashmentDeadline: isoDateSchema.nullable(),
  drawsPerYear: z.number().int().nullable(),
  notesEn: z.string().nullable(),
  notesUr: z.string().nullable(),
});
export type Denomination = z.infer<typeof denominationSchema>;

export const drawSummarySchema = z.object({
  id: z.number().int(),
  denominationCode: z.string(),
  drawNumber: z.number().int().nullable(),
  drawDate: isoDateSchema,
  city: z.string().nullable(),
  status: drawStatusSchema,
  completeness: completenessSchema,
  resultChecksum: z.string().nullable(),
  publishedAt: isoDateTimeSchema.nullable(),
  verifiedAt: isoDateTimeSchema.nullable(),
});
export type DrawSummary = z.infer<typeof drawSummarySchema>;

export const drawPrizeSchema = z.object({
  tier: tierSchema,
  amountPkr: z.number().int(),
  winnersCount: z.number().int(),
  inferred: z.boolean(),
});

export const drawSourceSchema = z.object({
  source: z.string(),
  url: z.string(),
  sha256: z.string(),
  fetchedAt: isoDateTimeSchema,
  role: z.enum(["primary", "corroborating", "conflicting"]),
  parsedCount: z.number().int(),
});

export const drawDetailSchema = drawSummarySchema.extend({
  prizes: z.array(drawPrizeSchema),
  tier1: z.array(bondNumberSchema),
  tier2: z.array(bondNumberSchema),
  sources: z.array(drawSourceSchema),
  /** Human readable notice shown when status is "disputed". */
  notice: z.string().nullable(),
});
export type DrawDetail = z.infer<typeof drawDetailSchema>;

const denominationParam = z.object({ denomination: z.string().min(1).max(12) });
const drawParams = denominationParam.extend({ drawNumber: z.coerce.number().int().min(1) });

export const listDenominations = defineEndpoint({
  id: "bonds.denominations",
  method: "GET",
  path: "/bonds/denominations",
  auth: "none",
  response: z.array(denominationSchema),
});

export const listDraws = defineEndpoint({
  id: "bonds.draws",
  method: "GET",
  path: "/bonds/draws",
  auth: "none",
  query: z.object({
    denomination: z.string().optional(),
    year: z.coerce.number().int().min(1999).max(2100).optional(),
    cursor: z.string().optional(),
  }),
  response: z.array(drawSummarySchema),
  meta: cursorMetaSchema,
});

export const getDraw = defineEndpoint({
  id: "bonds.draw",
  method: "GET",
  path: "/bonds/draws/{denomination}/{drawNumber}",
  auth: "none",
  params: drawParams,
  response: drawDetailSchema,
});

export const drawResultItemSchema = z.object({ bondNumber: bondNumberSchema, tier: tierSchema });

export const listDrawResults = defineEndpoint({
  id: "bonds.draw-results",
  method: "GET",
  path: "/bonds/draws/{denomination}/{drawNumber}/results",
  auth: "none",
  params: drawParams,
  query: pageQuerySchema.extend({ tier: z.coerce.number().int().min(1).max(3).optional() }),
  response: z.array(drawResultItemSchema),
  meta: pageMetaSchema,
});

/** Canonical text download, `text/plain`, immutable once the draw is verified. */
export const drawResultsText = defineEndpoint({
  id: "bonds.draw-results-text",
  method: "GET",
  path: "/bonds/draws/{denomination}/{drawNumber}/results.txt",
  auth: "none",
  params: drawParams,
  response: z.string(),
  raw: true,
});

export const latestDraws = defineEndpoint({
  id: "bonds.latest",
  method: "GET",
  path: "/bonds/latest",
  auth: "none",
  response: z.array(drawSummarySchema),
});

export const scheduleEntrySchema = z.object({
  denominationCode: z.string(),
  drawNumber: z.number().int().nullable(),
  drawDate: isoDateSchema,
  city: z.string().nullable(),
  status: drawStatusSchema,
});

export const getSchedule = defineEndpoint({
  id: "bonds.schedule",
  method: "GET",
  path: "/bonds/schedule",
  auth: "none",
  query: z.object({ year: z.coerce.number().int().min(1999).max(2100).optional() }),
  response: z.object({ year: z.number().int(), draws: z.array(scheduleEntrySchema) }),
});

const checkItemSchema = z
  .object({
    denomination: z.string().optional(),
    number: bondNumberSchema.optional(),
    from: bondNumberSchema.optional(),
    to: bondNumberSchema.optional(),
  })
  .refine((v) => (v.number !== undefined) !== (v.from !== undefined || v.to !== undefined), {
    message: "provide either number or from and to",
  })
  .refine((v) => (v.from === undefined) === (v.to === undefined), {
    message: "from and to must be given together",
  });

export const checkRequestSchema = z
  .object({ items: z.array(checkItemSchema).min(1).max(MAX_CHECK_NUMBERS) })
  .superRefine((value, ctx) => {
    let total = 0;
    for (const item of value.items) {
      if (item.number !== undefined) total += 1;
      else if (item.from !== undefined && item.to !== undefined) {
        const span = Number(item.to) - Number(item.from) + 1;
        if (span < 1) {
          ctx.addIssue({ code: "custom", message: "range end is before range start" });
          return;
        }
        total += span;
      }
    }
    if (total > MAX_CHECK_NUMBERS) {
      ctx.addIssue({ code: "custom", message: `at most ${MAX_CHECK_NUMBERS} numbers per request` });
    }
  });
export type CheckRequest = z.infer<typeof checkRequestSchema>;

export const checkWinSchema = z.object({
  bondNumber: bondNumberSchema,
  denominationCode: z.string(),
  drawId: z.number().int(),
  drawNumber: z.number().int().nullable(),
  drawDate: isoDateSchema,
  tier: tierSchema,
  amountPkr: z.number().int(),
});

export const checkBonds = defineEndpoint({
  id: "bonds.check",
  method: "POST",
  path: "/bonds/check",
  auth: "none",
  body: checkRequestSchema,
  response: z.object({
    checked: z.number().int(),
    wins: z.array(checkWinSchema),
  }),
});

export const coverageRowSchema = z.object({
  denominationCode: z.string(),
  year: z.number().int(),
  expected: z.number().int(),
  full: z.number().int(),
  top: z.number().int(),
  none: z.number().int(),
  verified: z.number().int(),
  disputed: z.number().int(),
  sources: z.record(z.string(), z.number().int()),
});

export const getCoverage = defineEndpoint({
  id: "bonds.coverage",
  method: "GET",
  path: "/bonds/coverage",
  auth: "none",
  response: z.array(coverageRowSchema),
});

export const bondsEndpoints = {
  listDenominations,
  listDraws,
  getDraw,
  listDrawResults,
  drawResultsText,
  latestDraws,
  getSchedule,
  checkBonds,
  getCoverage,
} as const;
