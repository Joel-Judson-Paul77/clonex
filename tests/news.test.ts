import { describe, expect, it } from "vitest";
import { NEWS, TOPIC_LABEL } from "@/lib/news";

describe("news articles", () => {
  it("has real-looking entries: https link, publisher, date, headline, summary and takeaway", () => {
    expect(NEWS.length).toBeGreaterThanOrEqual(5);
    for (const a of NEWS) {
      expect(a.url, a.headline).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\//i);
      for (const field of [a.headline, a.publisher, a.date, a.summary, a.takeaway]) expect(field.trim().length).toBeGreaterThan(3);
      expect(a.topic in TOPIC_LABEL).toBe(true);
      expect(a.image, a.headline).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/.+\.(jpe?g|png|webp)$/i);
    }
  });

  it("never lists the same article twice", () => {
    const urls = NEWS.map((a) => a.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("keeps summaries short, so they stay our own words and not copied article text", () => {
    for (const a of NEWS) expect(a.summary.length, a.headline).toBeLessThanOrEqual(320);
  });

  it("contains no invented testimonial furniture", () => {
    const text = JSON.stringify(NEWS).toLowerCase();
    expect(text).not.toMatch(/testimonial|5 stars|rating/);
  });
});
