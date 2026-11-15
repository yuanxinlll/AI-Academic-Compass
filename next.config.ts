import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local frontend dev without database credentials:
  // set API_PROXY_TARGET=https://ai-academic-compass.vercel.app in .env.local and every
  // /api/* request is proxied server-side to the live backend (no CORS issues).
  // Unset in production, so deployed builds always use their own routes.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");
    if (!target) return [];
    return {
      beforeFiles: [{ source: "/api/:path*", destination: `${target}/api/:path*` }],
      afterFiles: [],
      fallback: [],
    };
  },
  /* config options here */
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
};

export default nextConfig;
