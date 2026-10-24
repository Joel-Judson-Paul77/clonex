import { describe, expect, it } from "vitest";
import { cleanEmail, describeDispatch } from "@/lib/takedown";

describe("cleanEmail", () => {
  it("accepts and lower-cases a plain address", () => {
    expect(cleanEmail("  Security@Brand.COM ")).toBe("security@brand.com");
    expect(cleanEmail("joel.c+clonex@gmail.com")).toBe("joel.c+clonex@gmail.com");
  });

  it.each([
    ["not an email"],
    ["a@b"],
    ["a@b.com, c@d.com"], // lists
    ["a@b.com;c@d.com"],
    ["Joel <a@b.com>"], // display names
    ["a@b.com\nBcc: x@y.com"], // header injection
    ["@b.com"],
  ])("rejects %j", (v) => {
    expect(cleanEmail(v)).toBeUndefined();
  });

  it("rejects non-strings and over-long addresses", () => {
    expect(cleanEmail(42)).toBeUndefined();
    expect(cleanEmail(undefined)).toBeUndefined();
    expect(cleanEmail(`${"a".repeat(250)}@b.com`)).toBeUndefined();
  });
});

describe("describeDispatch", () => {
  it("names who was emailed", () => {
    expect(describeDispatch("demo", { action: "emailed", sentTo: ["a@x.com", "sec@brand.com"] })).toBe(
      "Emailed through n8n to a@x.com and sec@brand.com (demo mode: nothing went to the platform).",
    );
  });

  it("says when an address was not on the approved list", () => {
    expect(describeDispatch("demo", { action: "emailed", sentTo: ["a@x.com"], blocked: ["z@evil.com"] })).toContain(
      "Not on the approved list, so not emailed: z@evil.com.",
    );
  });

  it("says no email went out when n8n only logged the request", () => {
    expect(describeDispatch("demo", { action: "logged" })).toBe("Received and logged by n8n (demo mode: nothing went to the platform; no email was sent).");
  });

  it("never claims an email when n8n reports none sent", () => {
    expect(describeDispatch("demo", { action: "emailed", sentTo: [] })).not.toMatch(/^Emailed/);
  });
});
