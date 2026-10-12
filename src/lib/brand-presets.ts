import type { BrandCard } from "./brand-types";

// Built-in fallback registry so search still works if the store APIs are offline or rate-limited
// (e.g. on hackathon Wi-Fi). These are NOT live-verified when shown: the UI labels them "preset",
// and the profile form verifies them against the real stores right after they are picked.

export interface Preset {
  name: string;
  publisher: string;
  iosAppId?: string;
  androidPkg?: string;
  domain?: string;
  aliases?: string[];
}

// Each entry was looked up in the live App Store / Google Play when this list was built; entries
// without a confident match in a store are left out rather than guessed. Brands that exist in only
// one store simply omit the other ID.
export const PRESETS: Preset[] = [
  { name: "Paytm", publisher: "PayTM Mobile Solutions Private Limited", iosAppId: "473941634", androidPkg: "net.one97.paytm", domain: "paytm.com" },
  { name: "PhonePe", publisher: "PHONEPE PRIVATE LIMITED", iosAppId: "1170055821", androidPkg: "com.phonepe.app", domain: "phonepe.com" },
  { name: "Google Pay", publisher: "Google LLC", iosAppId: "1193357041", androidPkg: "com.google.android.apps.nbu.paisa.user", domain: "pay.google.com", aliases: ["gpay", "tez"] },
  { name: "Zomato", publisher: "Zomato Media Pvt. Ltd.", iosAppId: "434613896", androidPkg: "com.application.zomato", domain: "zomato.com" },
  { name: "Swiggy", publisher: "Bundl Technologies Private Limited", iosAppId: "989540920", androidPkg: "in.swiggy.android", domain: "swiggy.com" },
  { name: "Flipkart", publisher: "Flipkart Internet Private Limited", iosAppId: "742044692", androidPkg: "com.flipkart.android", domain: "flipkart.com" },
  { name: "Amazon", publisher: "AMAZON SELLER SERVICES PRIVATE LIMITED", iosAppId: "1478350915", androidPkg: "in.amazon.mShop.android.shopping", domain: "amazon.in", aliases: ["amazon shopping"] },
  { name: "Spotify", publisher: "Spotify", iosAppId: "324684580", androidPkg: "com.spotify.music", domain: "spotify.com" },
  { name: "Netflix", publisher: "Netflix, Inc.", iosAppId: "363590051", androidPkg: "com.netflix.mediaclient", domain: "netflix.com" },
  { name: "WhatsApp", publisher: "WhatsApp Inc.", iosAppId: "310633997", androidPkg: "com.whatsapp", domain: "whatsapp.com" },
  { name: "Instagram", publisher: "Instagram, Inc.", iosAppId: "389801252", androidPkg: "com.instagram.android", domain: "instagram.com" },
  { name: "Telegram", publisher: "Telegram FZ-LLC", iosAppId: "686449807", androidPkg: "org.telegram.messenger", domain: "telegram.org" },
  { name: "Binance", publisher: "Binance Switzerland AG", iosAppId: "1436799971", androidPkg: "com.binance.dev", domain: "binance.com" },
  { name: "Uber", publisher: "Uber Technologies, Inc.", iosAppId: "368677368", androidPkg: "com.ubercab", domain: "uber.com" },
  { name: "YouTube", publisher: "Google LLC", iosAppId: "544007664", androidPkg: "com.google.android.youtube", domain: "youtube.com" },
  { name: "CRED", publisher: "Dreamplug Technologies Private Limited", iosAppId: "1428580080", androidPkg: "com.dreamplug.androidapp", domain: "cred.club" },
  { name: "Slice", publisher: "GARAGEPRENEURS INTERNET PRIVATE LIMITED", iosAppId: "1123372237", androidPkg: "indwin.c3.shareapp", domain: "sliceit.com" },
  { name: "MobiKwik", publisher: "ONE MOBIKWIK SYSTEMS PRIVATE LIMITED", iosAppId: "600002523", androidPkg: "com.mobikwik_new", domain: "mobikwik.com" },
  { name: "Freecharge", publisher: "Freecharge Business And Technology Services Limited", iosAppId: "877495926", androidPkg: "com.freecharge.android", domain: "freechargebiz.in" },
  { name: "Zerodha Kite", publisher: "Zerodha Broking Limited", iosAppId: "1449453802", androidPkg: "com.zerodha.kite3", domain: "zerodha.com", aliases: ["kite", "zerodha"] },
  { name: "Upstox", publisher: "RKSV SECURITIES INDIA PRIVATE LIMITED", iosAppId: "1584953620", androidPkg: "in.upstox.app", domain: "upstox.com" },
  { name: "Angel One", publisher: "Angel One Ltd", iosAppId: "1060530981", androidPkg: "com.msf.angelmobile", domain: "angelone.in" },
  { name: "HDFC Bank", publisher: "HDFC Bank Ltd", iosAppId: "6504402552", androidPkg: "com.hdfcbank.android.now", domain: "hdfcbank.com", aliases: ["hdfc"] },
  { name: "ICICI iMobile", publisher: "ICICI Bank Ltd", iosAppId: "375276006", androidPkg: "com.csam.icici.bank.imobile", domain: "icicibank.com", aliases: ["icici"] },
  { name: "Axis Mobile", publisher: "Axis Bank Limited", iosAppId: "6448527099", androidPkg: "com.axis.mobile", domain: "axisbank.com", aliases: ["axis"] },
  { name: "Kotak Bank", publisher: "Kotak Mahindra Bank Ltd.", iosAppId: "6447808696", androidPkg: "com.kotak.bank.mobile", domain: "kotak811.com", aliases: ["kotak", "kotak811"] },
  { name: "Airtel Thanks", publisher: "Bharti Airtel Limited", iosAppId: "543184334", androidPkg: "com.myairtelapp", domain: "airtel.in", aliases: ["airtel"] },
  { name: "MyJio", publisher: "JIO PLATFORMS LIMITED", iosAppId: "1074964262", androidPkg: "com.jio.myjio", domain: "jio.com", aliases: ["jio"] },
  { name: "Myntra", publisher: "Myntra Designs Private Limited", iosAppId: "907394059", androidPkg: "com.myntra.android", domain: "myntra.com" },
  { name: "Meesho", publisher: "Meesho Inc.", iosAppId: "1457958492", androidPkg: "com.meesho.supply", domain: "meesho.com" },
  { name: "Nykaa", publisher: "FSN E-COMMERCE VENTURES PRIVATE LIMITED", iosAppId: "1022363908", androidPkg: "com.fsn.nykaa", domain: "nykaa.com" },
  { name: "Zepto", publisher: "KIRANAKART TECHNOLOGIES PRIVATE LIMITED", iosAppId: "1575323645", androidPkg: "com.zeptoconsumerapp", domain: "zeptonow.com" },
  { name: "Blinkit", publisher: "BLINK COMMERCE PRIVATE LIMITED", iosAppId: "960335206", androidPkg: "com.grofers.customerapp", domain: "blinkit.com", aliases: ["grofers"] },
  { name: "BigBasket", publisher: "SUPERMARKET GROCERY SUPPLIES PRIVATE LIMITED", iosAppId: "660683603", androidPkg: "com.bigbasket.mobileapp", domain: "bigbasket.com" },
  { name: "Starbucks", publisher: "Starbucks Coffee Company", iosAppId: "1210203958", androidPkg: "com.starbucks.in", domain: "starbucks.in" },
  { name: "Tata Neu", publisher: "TATA Digital Private Limited", iosAppId: "1584669293", androidPkg: "com.tatadigital.tcp", domain: "tataneu.com", aliases: ["tata"] },
  { name: "Snapdeal", publisher: "Snapdeal Limited", androidPkg: "com.snapdeal.main", domain: "snapdeal.com" },
  { name: "FirstCry", publisher: "FirstCry.com", androidPkg: "fc.admin.fcexpressadmin", domain: "firstcry.com" },
  { name: "Lenskart", publisher: "Lenskart Solutions Private Limited", iosAppId: "970343205", androidPkg: "com.lenskart.app", domain: "lenskart.com" },
  { name: "PharmEasy", publisher: "91streets Media Technologies Private Limited", iosAppId: "982432643", androidPkg: "com.phonegap.rxpal", domain: "pharmeasy.in" },
  { name: "Practo", publisher: "PRACTO TECHNOLOGIES PRIVATE LIMITED", iosAppId: "953772015", androidPkg: "com.practo.fabric", domain: "practo.com" },
  { name: "Tata 1mg", publisher: "TATA 1mg Healthcare Solutions Pvt Ltd", iosAppId: "554578419", androidPkg: "com.aranoah.healthkart.plus", domain: "1mg.com", aliases: ["1mg"] },
  { name: "Urban Company", publisher: "Urban Company Limited", iosAppId: "1032480595", androidPkg: "com.urbanclap.urbanclap", domain: "urbancompany.com", aliases: ["urbanclap"] },
  { name: "Ola", publisher: "ANI Technologies Pvt. Ltd.", iosAppId: "539179365", androidPkg: "com.olacabs.customer", domain: "olacabs.com", aliases: ["ola cabs"] },
  { name: "Rapido", publisher: "Roppen Transportation Services Private Limited", iosAppId: "1198464606", androidPkg: "com.rapido.passenger", domain: "rapido.bike" },
  { name: "MakeMyTrip", publisher: "MakeMyTrip India Pvt. Ltd.", iosAppId: "530488359", androidPkg: "com.makemytrip", domain: "makemytrip.com", aliases: ["mmt"] },
  { name: "Goibibo", publisher: "ibibo Web Pvt. Ltd", iosAppId: "631927169", androidPkg: "com.goibibo", domain: "goibibo.com" },
  { name: "IRCTC Rail Connect", publisher: "Indian Railway Catering and Tourism Corporation Limited", iosAppId: "1386197253", androidPkg: "cris.org.in.prs.ima", domain: "irctc.co.in", aliases: ["irctc"] },
  { name: "redBus", publisher: "PILANI SOFT LABS PRIVATE LIMITED", iosAppId: "733712604", androidPkg: "in.redbus.android", domain: "redbus.in" },
  { name: "Cleartrip", publisher: "Cleartrip Travel Services Pvt. Ltd.", iosAppId: "531324961", androidPkg: "com.cleartrip.android", domain: "cleartrip.com" },
  { name: "Airbnb", publisher: "Airbnb, Inc.", iosAppId: "401626263", androidPkg: "com.airbnb.android", domain: "airbnb.com" },
  { name: "Booking.com", publisher: "Booking.com B.V.", iosAppId: "367003839", androidPkg: "com.booking", domain: "booking.com", aliases: ["booking"] },
  { name: "Yatra", publisher: "Yatra Online Private Limited", iosAppId: "730234679", androidPkg: "com.yatra.base", domain: "yatra.com" },
  { name: "EaseMyTrip", publisher: "EaseMyTrip—Flight, Hotel, IRCTC Authorised Partner", androidPkg: "com.easemytrip.android", domain: "easemytrip.com" },
  { name: "Facebook", publisher: "Meta Platforms, Inc.", iosAppId: "284882215", androidPkg: "com.facebook.katana", domain: "facebook.com", aliases: ["fb"] },
  { name: "X (Twitter)", publisher: "X Corp.", iosAppId: "333903271", androidPkg: "com.twitter.android", domain: "x.com", aliases: ["twitter", "x"] },
  { name: "Snapchat", publisher: "Snap, Inc.", iosAppId: "447188370", androidPkg: "com.snapchat.android", domain: "snapchat.com" },
  { name: "Pinterest", publisher: "Pinterest, Inc.", iosAppId: "429047995", androidPkg: "com.pinterest", domain: "pinterest.com" },
  { name: "LinkedIn", publisher: "LinkedIn Corporation", iosAppId: "288429040", androidPkg: "com.linkedin.android", domain: "linkedin.com" },
  { name: "Reddit", publisher: "REDDIT, INC.", iosAppId: "1064216828", androidPkg: "com.reddit.frontpage", domain: "reddit.com" },
  { name: "Discord", publisher: "Discord Inc.", iosAppId: "985746746", androidPkg: "com.discord", domain: "discord.com" },
  { name: "Prime Video", publisher: "AMZN Mobile LLC", iosAppId: "545519333", androidPkg: "com.amazon.avod.thirdpartyclient", domain: "primevideo.com", aliases: ["prime video"] },
  { name: "Sony LIV", publisher: "SONY PICTURES NETWORKS INDIA PVT LTD", iosAppId: "587794258", androidPkg: "com.sonyliv", domain: "sonyliv.com", aliases: ["sonyliv"] },
  { name: "ZEE5", publisher: "Z5X Global FZ-LLC", iosAppId: "743691886", androidPkg: "com.graymatrix.did", domain: "zee5.com", aliases: ["zee5"] },
  { name: "Gaana", publisher: "Gamma Gaana Ltd", iosAppId: "585270521", androidPkg: "com.gaana", domain: "gaana.com" },
  { name: "JioSaavn", publisher: "Saavn Media Limited", iosAppId: "441813332", androidPkg: "com.jio.media.jiobeats", domain: "jiosaavn.com", aliases: ["saavn"] },
  { name: "Truecaller", publisher: "True Software Scandinavia AB", iosAppId: "448142450", androidPkg: "com.truecaller", domain: "truecaller.com" },
  { name: "ShareChat", publisher: "MOHALLA TECH PRIVATE LIMITED", iosAppId: "1440640105", androidPkg: "in.mohalla.sharechat", domain: "sharechat.com" },
  { name: "Coinbase", publisher: "Coinbase, Inc.", iosAppId: "886427730", androidPkg: "com.coinbase.android", domain: "coinbase.com" },
  { name: "WazirX", publisher: "Zanmai Labs Private Limited", iosAppId: "1349082789", androidPkg: "com.wrx.wazirx", domain: "wazirx.com" },
  { name: "CoinDCX", publisher: "Primestack PTE. Ltd.", iosAppId: "1517787269", androidPkg: "com.coindcx.btc", domain: "coindcx.com" },
  { name: "PayPal", publisher: "PayPal, Inc.", iosAppId: "283646709", androidPkg: "com.paypal.android.p2pmobile", domain: "paypal.com" },
  { name: "Wise", publisher: "Wise Payments Ltd", iosAppId: "612261027", androidPkg: "com.transferwise.android", domain: "wise.com", aliases: ["transferwise"] },
  { name: "Revolut", publisher: "Revolut Ltd", iosAppId: "932493382", androidPkg: "com.revolut.revolut", domain: "revolut.com" },
  { name: "Cash App", publisher: "Block, Inc.", androidPkg: "com.squareup.cash", domain: "cash.app", aliases: ["cashapp"] },
  { name: "Google", publisher: "Google LLC", iosAppId: "284815942", androidPkg: "com.google.android.googlequicksearchbox", domain: "google.com" },
  { name: "Gmail", publisher: "Google LLC", iosAppId: "422689480", androidPkg: "com.google.android.gm", domain: "gmail.com" },
  { name: "Microsoft Teams", publisher: "Microsoft Corporation", iosAppId: "1113153706", androidPkg: "com.microsoft.teams", domain: "microsoft.com", aliases: ["teams"] },
  { name: "Zoom", publisher: "Zoom Communications, Inc.", iosAppId: "546505307", androidPkg: "us.zoom.videomeetings", domain: "zoom.com" },
  { name: "Slack", publisher: "SLACK TECHNOLOGIES L.L.C.", iosAppId: "618783545", androidPkg: "com.Slack", domain: "slack.com" },
  { name: "Dropbox", publisher: "Dropbox, Inc.", iosAppId: "327630330", androidPkg: "com.dropbox.android", domain: "dropbox.com" },
  { name: "Notion", publisher: "Notion Labs, Incorporated", iosAppId: "1232780281", androidPkg: "notion.id", domain: "notion.so" },
  { name: "Canva", publisher: "Canva Pty Ltd", iosAppId: "897446215", androidPkg: "com.canva.editor", domain: "canva.com" },
  { name: "Tinder", publisher: "Tinder LLC", iosAppId: "547702041", androidPkg: "com.tinder", domain: "tinder.com" },
  { name: "Bumble", publisher: "Bumble Holding Limited", iosAppId: "930441707", androidPkg: "com.bumble.app", domain: "bumble.com" },
  { name: "Duolingo", publisher: "Duolingo, Inc", iosAppId: "570060128", androidPkg: "com.duolingo", domain: "duolingo.com" },
  { name: "BYJU'S", publisher: "Toppr", androidPkg: "com.byjus.thelearningapp", domain: "byjus.com", aliases: ["byjus"] },
  { name: "Unacademy", publisher: "Unacademy", androidPkg: "com.unacademyapp", domain: "unacademy.com" },
  { name: "Coursera", publisher: "Coursera, Inc.", iosAppId: "736535961", androidPkg: "org.coursera.android", domain: "coursera.org" },
  { name: "Temu", publisher: "Whaleco Inc.", iosAppId: "1641486558", androidPkg: "com.einnovation.temu", domain: "temu.com" },
  { name: "eBay", publisher: "eBay Inc.", iosAppId: "282614216", androidPkg: "com.ebay.mobile", domain: "ebay.com" },
  { name: "Hinge", publisher: "Hinge, Inc.", iosAppId: "595287172", androidPkg: "co.hinge.app", domain: "hinge.co" },
  { name: "Shazam", publisher: "Apple Distribution International", iosAppId: "284993459", androidPkg: "com.shazam.android", domain: "shazam.com" },
  { name: "Uber Eats", publisher: "Uber Technologies, Inc.", iosAppId: "1058959277", androidPkg: "com.ubercab.eats", domain: "ubereats.com" },
  { name: "DoorDash", publisher: "DoorDash, Inc.", iosAppId: "719972451", androidPkg: "com.dd.doordash", domain: "doordash.com" },
  { name: "Lyft", publisher: "Lyft, Inc.", iosAppId: "529379082", androidPkg: "me.lyft.android", domain: "lyft.com" },
];

/** Brands shown as one-click bubbles under the search bar (all exist in PRESETS). */
export const FEATURED = ["Paytm", "PhonePe", "Zomato", "Swiggy", "Spotify", "WhatsApp", "Instagram", "Binance", "Uber", "Netflix"];

export function featuredPresets(): Preset[] {
  return FEATURED.map((n) => PRESETS.find((p) => p.name === n)).filter((p): p is Preset => !!p);
}

export function presetCard(p: Preset): BrandCard {
  return {
    key: `preset:${p.name.toLowerCase()}`,
    name: p.name,
    publisher: p.publisher,
    ios: p.iosAppId ? { appId: p.iosAppId, title: p.name } : undefined,
    android: p.androidPkg ? { pkg: p.androidPkg, title: p.name } : undefined,
    domain: p.domain,
    origin: "preset",
  };
}

/** Presets whose name or alias starts with / contains the query (instant, offline). */
export function matchPresets(q: string, limit = 5): BrandCard[] {
  const n = q.trim().toLowerCase();
  if (n.length < 1) return [];
  return PRESETS.map((p) => {
    const names = [p.name, ...(p.aliases ?? [])].map((x) => x.toLowerCase());
    const exact = names.some((x) => x === n);
    const starts = names.some((x) => x.startsWith(n));
    const has = names.some((x) => x.includes(n));
    return { p, score: exact ? 3 : starts ? 2 : has ? 1 : 0 };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => presetCard(x.p));
}
