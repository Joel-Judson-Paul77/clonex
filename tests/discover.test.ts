import { describe, expect, it } from "vitest";
import { countChannels, emptyChannels, extractChannels, isPublicIp, mergeChannels, wikidataAccounts, wikidataMatchesDomain, youtubeHandleFromPage } from "@/lib/discover";
import type { WikidataEntity } from "@/lib/discover";

describe("extractChannels", () => {
  const html = `
    <footer>
      <a href="https://www.youtube.com/@paytm">YouTube</a>
      <a href="https://t.me/paytm_official">Telegram</a>
      <a href="https://bsky.app/profile/paytm.bsky.social">Bluesky</a>
      <a href="https://twitter.com/Paytm">X</a>
    </footer>`;

  it("finds the official YouTube, Telegram and Bluesky accounts a page links to", () => {
    expect(extractChannels(html)).toEqual({ youtube: ["paytm"], telegram: ["paytm_official"], bluesky: ["paytm.bsky.social"], youtubeRefs: [] });
  });

  it("reads links written inside JSON-LD or escaped data", () => {
    const json = '{"sameAs":["https:\\/\\/www.youtube.com\\/@brandhq","https:\\/\\/t.me\\/brand_news"]}';
    const c = extractChannels(json);
    expect(c.youtube).toEqual(["brandhq"]);
    expect(c.telegram).toEqual(["brand_news"]);
  });

  it("accepts the other official Telegram hosts and the /s/ preview form", () => {
    expect(extractChannels('<a href="https://telegram.me/brandhelp">x</a>').telegram).toEqual(["brandhelp"]);
    expect(extractChannels('<a href="https://t.me/s/brandfeed">x</a>').telegram).toEqual(["brandfeed"]);
  });

  it("ignores Telegram links that are not accounts, and YouTube links that are videos", () => {
    const c = extractChannels(
      '<a href="https://t.me/joinchat/AAAA">a</a><a href="https://t.me/share/url?url=x">b</a><a href="https://t.me/+abc123">c</a>' +
        '<a href="https://www.youtube.com/watch?v=abc123">v</a><a href="https://www.youtube.com/iframe_api">api</a>',
    );
    expect(countChannels(c)).toBe(0);
  });

  it("keeps older YouTube link styles (custom name, user, channel ID) to be resolved to a handle", () => {
    const c = extractChannels('<a href="https://youtube.com/c/paytm">1</a><a href="https://www.youtube.com/channel/UCgnxoUwDmmyzeigmmcf0hZA">2</a><a href="https://www.youtube.com/user/oldname">3</a>');
    expect(c.youtube).toEqual([]);
    expect(c.youtubeRefs).toEqual(["c/paytm", "channel/UCgnxoUwDmmyzeigmmcf0hZA", "user/oldname"]);
  });

  it("removes duplicates (ignoring case) and caps each kind at three", () => {
    const many = ["a1b2", "c3d4", "e5f6", "g7h8", "i9j0"].map((h) => `<a href="https://t.me/${h}_x">x</a>`).join("") + '<a href="https://t.me/A1B2_X">dup</a>';
    expect(extractChannels(many).telegram).toHaveLength(3);
    expect(extractChannels('<a href="https://www.youtube.com/@Brand">1</a><a href="https://www.youtube.com/@brand">2</a>').youtube).toHaveLength(1);
  });

  it("returns nothing for a page with no social links", () => {
    expect(countChannels(extractChannels("<html><body>Hello</body></html>"))).toBe(0);
  });
});

describe("isPublicIp (stops the server being pointed at internal addresses)", () => {
  it.each(["8.8.8.8", "142.250.80.46", "2606:4700:4700::1111", "172.32.0.1", "100.63.0.1"])("allows %s", (ip) => {
    expect(isPublicIp(ip)).toBe(true);
  });

  it.each([
    "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
    "::1", "::", "fe80::1", "fd00::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "not-an-ip", "999.1.1.1",
  ])("blocks %s", (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });
});

describe("youtubeHandleFromPage", () => {
  it("reads the @handle from the canonical link or the channel data", () => {
    expect(youtubeHandleFromPage('<link rel="canonical" href="https://www.youtube.com/@paytm">')).toBe("paytm");
    expect(youtubeHandleFromPage('{"canonicalBaseUrl":"/@PhonePe_"}')).toBe("PhonePe_");
  });
  it("returns null when the page has no handle", () => {
    expect(youtubeHandleFromPage("<html>consent page</html>")).toBeNull();
  });
});

describe("Wikidata", () => {
  const claim = (value: unknown, rank = "normal") => ({ rank, mainsnak: { datavalue: { value } } });
  const entity: WikidataEntity = {
    claims: {
      P856: [claim("https://www.paytm.com/")],
      P2397: [claim("UCgnxoUwDmmyzeigmmcf0hZA"), claim("UCdeprecated0000000000000", "deprecated")],
      P3789: [claim("paytm_official")],
      P12361: [claim("Paytm.BSKY.social")],
    },
  };

  it("matches an entity only when its official website is on the brand's domain", () => {
    expect(wikidataMatchesDomain(entity, "paytm.com")).toBe(true);
    expect(wikidataMatchesDomain(entity, "paytmmall.com")).toBe(false);
    expect(wikidataMatchesDomain({ claims: { P856: [claim("https://paytm.com.evil.io/")] } }, "paytm.com")).toBe(false);
    expect(wikidataMatchesDomain({}, "paytm.com")).toBe(false);
  });

  it("reads the official accounts, skipping deprecated and malformed values", () => {
    const a = wikidataAccounts(entity);
    expect(a.youtubeRefs).toEqual(["channel/UCgnxoUwDmmyzeigmmcf0hZA"]);
    expect(a.telegram).toEqual(["paytm_official"]);
    expect(a.bluesky).toEqual(["paytm.bsky.social"]);
    expect(countChannels(wikidataAccounts({ claims: { P3789: [claim("no spaces allowed")] } }))).toBe(0);
  });

  it("merges two sources without duplicates", () => {
    const a = emptyChannels();
    a.telegram.push("brandhq");
    const b = emptyChannels();
    b.telegram.push("BrandHQ", "brand_news");
    expect(mergeChannels(a, b).telegram).toEqual(["brandhq", "brand_news"]);
  });
});
