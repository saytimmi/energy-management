import { describe, it, expect } from "vitest";
import { parseRoute } from "../mini-app/router";

describe("parseRoute", () => {
  it("parses simple route", () => {
    expect(parseRoute("#hub")).toEqual({ route: "hub", param: undefined });
  });

  it("parses route with param", () => {
    expect(parseRoute("#balance/health")).toEqual({ route: "balance", param: "health" });
  });

  it("parses kaizen with numeric param", () => {
    expect(parseRoute("#kaizen/42")).toEqual({ route: "kaizen", param: "42" });
  });

  it("parses balance/strategy", () => {
    expect(parseRoute("#balance/strategy")).toEqual({ route: "balance", param: "strategy" });
  });

  it("defaults to hub for empty hash", () => {
    expect(parseRoute("")).toEqual({ route: "hub", param: undefined });
    expect(parseRoute("#")).toEqual({ route: "hub", param: undefined });
  });

  it("defaults to hub for unknown route", () => {
    expect(parseRoute("#unknown")).toEqual({ route: "hub", param: undefined });
  });
});
