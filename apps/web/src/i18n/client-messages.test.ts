import { describe, expect, it } from "vitest";
import { clientMessages, flattenMessages, pickNamespaces } from "./client-messages";

const messages = {
  common: { actions: { retry: "Try again" }, status: { loading: "Loading" }, privacy: { title: "Privacy" } },
  bonds: { nav: { title: "Prize bonds" } },
};

describe("client messages", () => {
  it("sends only what shell islands need", () => {
    expect(clientMessages(messages)).toEqual({ common: { actions: { retry: "Try again" }, status: { loading: "Loading" } } });
  });

  it("picks whole namespaces for a lane island", () => {
    expect(pickNamespaces(messages, ["bonds"])).toEqual({ bonds: { nav: { title: "Prize bonds" } } });
  });

  it("flattens nested messages to dotted keys", () => {
    expect(flattenMessages({ a: "x", b: { c: "y", d: { e: "z" } } })).toEqual({ a: "x", "b.c": "y", "b.d.e": "z" });
  });
});
