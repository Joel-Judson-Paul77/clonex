import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonces: the app is a single client page, so 'unsafe-inline' scripts are the documented trade-off
// (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md, "Without Nonces").
// Images stay open to any https host because scan results show avatars and icons from many platforms.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
  "font-src 'self' data: https://cdn.fontshare.com https://api.fontshare.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  devIndicators: false, // hide the dev-only "N" badge that overlaps the page; errors still show
  poweredByHeader: false, // don't advertise the framework
  serverExternalPackages: ["google-play-scraper", "sharp"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
