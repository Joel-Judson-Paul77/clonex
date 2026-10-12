import type { Metadata } from "next";
import { DM_Mono, Syne } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// Display + label faces. Body face (General Sans) is loaded from Fontshare below.
const syne = Syne({ variable: "--font-syne", subsets: ["latin"], weight: ["500", "600", "700"] });
const dmMono = DM_Mono({ variable: "--font-dm-mono", subsets: ["latin"], weight: ["400", "500"] });
const FONT_CSS = "https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap";

export const metadata: Metadata = {
  title: "CloneX — Brand impersonation monitoring",
  description: "Find fake profiles, pages and apps impersonating your brand.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmMono.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        {/* Load the body font without blocking first paint: the page renders in the system font straight
            away and swaps to General Sans when it arrives (or stays on the system font if Fontshare is down). */}
        <Script id="load-general-sans" strategy="beforeInteractive">
          {`(function(){var l=document.createElement("link");l.rel="stylesheet";l.href=${JSON.stringify(FONT_CSS)};document.head.appendChild(l);})();`}
        </Script>
        <noscript>
          <link rel="stylesheet" href={FONT_CSS} />
        </noscript>
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
