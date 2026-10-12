import { describe, expect, it } from "vitest";
import { ApiError, errorResponse, logoDataUrl, rateLimit, readJson, str, strList } from "@/lib/api-guard";

const req = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

describe("readJson", () => {
  it("parses a JSON object", async () => {
    expect(await readJson(req('{"a":1}'), 1000)).toEqual({ a: 1 });
  });

  it.each([
    ["", 400, /empty/i],
    ["{bad", 400, /not valid JSON/i],
    ["[1,2]", 400, /object/i],
    ['"text"', 400, /object/i],
  ])("rejects %j", async (body, status, msg) => {
    await expect(readJson(req(body), 1000)).rejects.toMatchObject({ status, message: expect.stringMatching(msg) });
  });

  it("rejects a body over the size limit with 413", async () => {
    await expect(readJson(req(JSON.stringify({ a: "x".repeat(2000) })), 1000)).rejects.toMatchObject({ status: 413 });
  });
});

describe("str", () => {
  it("trims and returns a string", () => {
    expect(str("  Paytm ", "name", { min: 3, max: 60 })).toBe("Paytm");
  });
  it("enforces required, type and length", () => {
    expect(() => str(undefined, "name", { max: 10 })).toThrow(ApiError);
    expect(() => str(42, "name", { max: 10 })).toThrow(/must be a string/);
    expect(() => str("ab", "name", { min: 3, max: 10 })).toThrow(/at least 3/);
    expect(() => str("x".repeat(11), "name", { max: 10 })).toThrow(/at most 10/);
  });
  it("allows an optional field to be missing", () => {
    expect(str(undefined, "x", { max: 10, optional: true })).toBeUndefined();
    expect(str("", "x", { max: 10, optional: true })).toBeUndefined();
  });
});

describe("strList", () => {
  it("cleans a list and drops empties", () => {
    expect(strList([" a ", "", "b"], "list", 5, 10)).toEqual(["a", "b"]);
  });
  it("rejects a non-list, too many items and long items", () => {
    expect(() => strList("x", "list", 5, 10)).toThrow(/must be a list/);
    expect(() => strList(Array(6).fill("a"), "list", 5, 10)).toThrow(/at most 5 items/);
    expect(() => strList(["x".repeat(11)], "list", 5, 10)).toThrow(/at most 10 characters/);
    expect(() => strList([1], "list", 5, 10)).toThrow(/must be a string/);
  });
});

describe("logoDataUrl", () => {
  const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString("base64");
  it("accepts a real PNG data URL", () => {
    expect(logoDataUrl(png, 10_000)).toBe(png);
  });
  it("rejects other types and wrong content", () => {
    expect(() => logoDataUrl("data:text/html;base64,PHNjcmlwdD4=", 10_000)).toThrow(ApiError);
    expect(() => logoDataUrl("data:image/png;base64," + Buffer.from("not an image at all").toString("base64"), 10_000)).toThrow(ApiError);
  });
  it("rejects an oversized image", () => {
    const big = "data:image/png;base64," + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(2000)]).toString("base64");
    expect(() => logoDataUrl(big, 500)).toThrow(/at most/);
    expect(logoDataUrl(big, 5000)).toBe(big);
  });
});

describe("rateLimit", () => {
  it("allows up to the limit, then answers 429 with a wait time", () => {
    const r = new Request("http://localhost/", { headers: { "x-forwarded-for": "203.0.113.9" } });
    for (let i = 0; i < 3; i++) rateLimit(r, "test-route", 3);
    try {
      rateLimit(r, "test-route", 3);
      throw new Error("should have been limited");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(429);
      expect((e as ApiError).message).toMatch(/Try again in \d+s/);
    }
  });

  it("counts each client and each route separately", () => {
    const a = new Request("http://localhost/", { headers: { "x-forwarded-for": "198.51.100.1" } });
    const b = new Request("http://localhost/", { headers: { "x-forwarded-for": "198.51.100.2" } });
    for (let i = 0; i < 2; i++) rateLimit(a, "route-a", 2);
    expect(() => rateLimit(b, "route-a", 2)).not.toThrow();
    expect(() => rateLimit(a, "route-b", 2)).not.toThrow();
  });
});

describe("errorResponse", () => {
  it("turns an ApiError into its status and message, and anything else into a safe 500", async () => {
    const a = errorResponse(new ApiError(400, "Bad input"));
    expect(a.status).toBe(400);
    expect(await a.json()).toEqual({ error: "Bad input" });
    const b = errorResponse(new Error("secret stack detail"));
    expect(b.status).toBe(500);
    expect(JSON.stringify(await b.json())).not.toMatch(/secret/);
  });
});
