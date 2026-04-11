import type { z } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
export type AuthKind = "none" | "wallet" | "cron";

/**
 * A typed description of one HTTP endpoint. `path` may contain `{param}` placeholders that
 * are filled from `params`. `response` describes `data` in the `{ data, meta }` envelope.
 */
export interface Endpoint<
  P extends z.ZodType | undefined = z.ZodType | undefined,
  Q extends z.ZodType | undefined = z.ZodType | undefined,
  B extends z.ZodType | undefined = z.ZodType | undefined,
  R extends z.ZodType = z.ZodType,
> {
  id: string;
  method: HttpMethod;
  path: string;
  auth: AuthKind;
  params?: P;
  query?: Q;
  body?: B;
  response: R;
  /** Optional description of `meta` (pagination, attribution, ...). */
  meta?: z.ZodType;
  /** Endpoints that answer with a redirect or a file instead of the JSON envelope. */
  raw?: boolean;
}

export function defineEndpoint<
  P extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
  B extends z.ZodType | undefined = undefined,
  R extends z.ZodType = z.ZodType,
>(endpoint: Endpoint<P, Q, B, R>): Endpoint<P, Q, B, R> {
  return endpoint;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEndpoint = Endpoint<any, any, any, any>;

export type InferResponse<E extends AnyEndpoint> = z.infer<E["response"]>;

type InputOf<S> = S extends z.ZodType ? z.input<S> : never;

/** Input accepted by `ApiClient.call` for an endpoint: only the parts it declares. */
export type EndpointInput<E extends AnyEndpoint> = (E["params"] extends z.ZodType
  ? { params: InputOf<E["params"]> }
  : object) &
  (E["query"] extends z.ZodType ? { query: InputOf<E["query"]> } : object) &
  (E["body"] extends z.ZodType ? { body: InputOf<E["body"]> } : object);
