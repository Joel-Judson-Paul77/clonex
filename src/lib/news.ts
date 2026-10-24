/**
 * Real news and official-warning coverage about phishing and impersonation scams in India.
 * Each entry was opened and checked against the publisher's page: the headline, publisher and link are the
 * publisher's own, the summary is our own short paraphrase, and the date is as shown on the page.
 * Nothing here is copied article text. Add an entry only after opening the link and confirming all four fields.
 */
export type NewsTopic = "scale" | "kyc" | "fake-apps" | "official";

export interface NewsArticle {
  headline: string;
  publisher: string;
  /** As displayed on the publisher's page; precision varies, so it is a label and not a parsed date. */
  date: string;
  url: string;
  topic: NewsTopic;
  /** Our own short summary of what the article reports. */
  summary: string;
  /** Why it matters for impersonation monitoring (our analysis, not the publisher's claim). */
  takeaway: string;
}

export const TOPIC_LABEL: Record<NewsTopic, string> = {
  scale: "The scale",
  kyc: "Fake KYC lures",
  "fake-apps": "Fake apps",
  official: "Official warnings",
};

export const NEWS: NewsArticle[] = [
  {
    headline: "Fraud Alert: India Is Losing over ₹22,000 Crore a Year in Cyber Scams — and the Worst Is Yet To Come",
    publisher: "Moneylife",
    date: "29 May 2026",
    url: "https://www.moneylife.in/article/fraud-alert-india-is-losing-over-22000-crore-a-year-in-cyber-scams-and-the-worst-is-yet-to-come/80612.html",
    topic: "scale",
    summary: "Starts from the FBI's 2025 Internet Crime Report and argues that India is losing more than ₹22,000 crore a year to cyber scams, with the problem still growing.",
    takeaway: "At this scale, analysts need the most dangerous fakes first, with evidence they can act on quickly.",
  },
  {
    headline: "SBI Warns Customers against Fake KYC, Reward Messages",
    publisher: "Kashmir Life",
    date: "8 January 2026",
    url: "https://kashmirlife.net/sbi-warns-customers-against-fake-kyc-reward-messages-420146/",
    topic: "kyc",
    summary: "State Bank of India warns about SMS and WhatsApp messages that pose as KYC updates or reward claims and push people to download an app. The bank says it never sends app-download links for these, and points victims to the 1930 cybercrime helpline.",
    takeaway: "The lure is a fake KYC or rewards message. KYC and reward bait are signals CloneX scores in listing text.",
  },
  {
    headline: "KYC Scams Are Zooming: How Fraudsters Hijack Bank Accounts",
    publisher: "Decode (formerly BOOM)",
    date: "5 September 2024",
    url: "https://www.decodeinternet.in/decode/kyc-scams-are-zooming-how-fraudsters-hijack-bank-accounts-26386",
    topic: "kyc",
    summary: "Explains how KYC scams still cause serious losses despite the RBI's safety measures, and cites RBI data on thousands of reported banking-operation frauds in 2021-22.",
    takeaway: "Scammers reuse the bank's name and the KYC story, which is why look-alike names and scam wording matter.",
  },
  {
    headline: "Sebi circular on frauds: Verify registration before taking investment tips",
    publisher: "Business Standard",
    date: "20 April 2025",
    url: "https://www.business-standard.com/finance/personal-finance/sebi-circular-on-frauds-verify-registration-before-taking-investment-tips-125042000636_1.html",
    topic: "official",
    summary: "Reports on SEBI's circular on social-media investment fraud: anyone claiming to be a registered advisor or research analyst must give a valid registration number, so investors should verify it first.",
    takeaway: "Impersonating a registered firm is a pattern worth monitoring: look-alike names, copied logos and unofficial accounts.",
  },
  {
    headline: "BSE Cautions Investors Against Investing In Advice From Fraudulent Trading Apps",
    publisher: "BW Businessworld",
    date: "2024",
    url: "https://www.businessworld.in/article/bse-cautions-investors-against-investing-in-advice-from-fraudulent-trading-apps-521349",
    topic: "fake-apps",
    summary: "BSE warns investors against acting on advice from fraudulent trading apps.",
    takeaway: "Fake trading apps are the app-store side of the problem that CloneX scans for.",
  },
  {
    headline: "RBI Cautions Bank Customers About KYC Updation Frauds",
    publisher: "Moneylife",
    date: "2 February 2024",
    url: "https://www.moneylife.in/article/rbi-cautions-bank-customers-about-kyc-updation-frauds/73298.html",
    topic: "official",
    summary: "After continuing reports of customers being defrauded in the name of KYC updation, the Reserve Bank of India once again urged people to be careful.",
    takeaway: "Official warnings keep repeating while the fakes keep appearing, so brands need monitoring of their own.",
  },
];
