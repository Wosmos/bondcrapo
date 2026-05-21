import { z } from "zod";
import { checkWinSchema, drawStatusSchema } from "./bonds";

/**
 * Lane A additions to the frozen bond contracts. Responses still parse with the M1 schemas
 * (extra keys are allowed); these schemas describe the extra fields for clients that use them.
 * Import from "@bondcheck/shared/api/bonds-extra".
 */

/** A win from `POST /bonds/check` with what the M1 shape cannot express. */
export const checkWinExtraSchema = checkWinSchema.extend({
  /** False when no document states the prize amount for that (old) draw; `amountPkr` is then 0. */
  amountKnown: z.boolean(),
  /** The draw's status, so clients can flag wins in disputed draws. */
  status: drawStatusSchema,
});
export type CheckWinExtra = z.infer<typeof checkWinExtraSchema>;

export const checkResponseExtraSchema = z.object({
  checked: z.number().int(),
  wins: z.array(checkWinExtraSchema),
});
export type CheckResponseExtra = z.infer<typeof checkResponseExtraSchema>;
