import { ArrowUpRight, Landmark, MessageSquareWarning, ShieldAlert, Smartphone, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NEWS, TOPIC_LABEL, type NewsArticle, type NewsTopic } from "@/lib/news";

// Layout adapted from the "testimonial basic" block: alternating two-column rows, hatch-pattern panel, mono labels.
// The content is real, sourced news. No people, quotes, ratings or stock photos are used.

const TOPIC_ICON: Record<NewsTopic, LucideIcon> = {
  scale: TrendingUp,
  kyc: MessageSquareWarning,
  "fake-apps": Smartphone,
  official: Landmark,
};

const HATCH = "bg-[repeating-linear-gradient(45deg,rgb(var(--ink)/0.1)_0px_1px,transparent_1px_8px)]";

function ArticleRow({ a, index }: { a: NewsArticle; index: number }) {
  const Icon = TOPIC_ICON[a.topic];
  return (
    <article className="grid grid-cols-1 border-y border-white/10 lg:grid-cols-12">
      <div className={cn("relative flex min-h-48 flex-col justify-between overflow-hidden bg-white/[0.03] p-6 lg:col-span-4", index % 2 === 1 && "lg:order-2")}>
        <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", HATCH)} />
        <div className="relative z-10 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/60">
          <Icon aria-hidden="true" className="size-4" />
          {TOPIC_LABEL[a.topic]}
        </div>
        <div className="relative z-10 mt-8 rounded-2xl border border-white/15 bg-black/40 px-5 py-4 backdrop-blur">
          <p className="text-lg font-semibold text-white">{a.publisher}</p>
          <p className="mt-0.5 font-mono text-xs tracking-tight text-white/60">{a.date}</p>
        </div>
      </div>

      <div className={cn("flex flex-col lg:col-span-8", index % 2 === 1 ? "lg:border-r lg:border-white/10" : "lg:border-l lg:border-white/10")}>
        <div className="flex-1 p-5 sm:p-6">
          <h3 className="text-xl font-semibold leading-snug text-white sm:text-2xl">{a.headline}</h3>
          <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">{a.summary}</p>
          <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white/75">
            <span className="mr-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-white/55">CloneX takeaway</span>
            {a.takeaway}
          </p>
        </div>
        <div className="border-t border-white/10 px-5 py-3 sm:px-6">
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:underline"
          >
            Read at {a.publisher} <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>
    </article>
  );
}

/** "In the news": real articles on phishing and impersonation scams in India, each linking to its publisher. */
export function NewsArticles({ articles = NEWS, className }: { articles?: NewsArticle[]; className?: string }) {
  return (
    <section aria-labelledby="news-title" className={cn("relative z-10 px-5 py-20 sm:px-8 lg:px-16", className)}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="inline-flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-widest text-white/60">
            <ShieldAlert aria-hidden="true" className="size-4" /> In the news
          </p>
          <h2 id="news-title" className="mt-3 bg-gradient-to-b from-white to-white/55 bg-clip-text text-4xl font-semibold leading-tight tracking-tight text-transparent sm:text-5xl">
            This is already happening in India.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/60 sm:text-base">
            Real reporting and official warnings on phishing, fake KYC messages and fake apps. Headlines and links are the publishers&apos;; the summaries are ours.
          </p>
        </div>
        <div className="border-x border-white/10">
          {articles.map((a, i) => (
            <ArticleRow key={a.url} a={a} index={i} />
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-white/45">
          Figures and claims belong to the linked publishers; check the originals. Dates are as shown on each page.
        </p>
      </div>
    </section>
  );
}

export default NewsArticles;
