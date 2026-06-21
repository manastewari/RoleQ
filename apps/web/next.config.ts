import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

// Next.js only auto-loads env files from apps/web. This monorepo keeps one
// repository-root .env shared by the web and API services, so expose only the
// explicitly public values to the web build.
try {
  const rootEnv = readFileSync(resolve(process.cwd(), "../../.env"), "utf8");
  for (const line of rootEnv.split(/\r?\n/)) {
    const match = line.match(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
} catch {
  // Deployment environments can provide these variables directly.
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep production builds from overwriting the live development server's assets.
  // Vercel's isolated Next.js service requires the conventional `.next` path.
  distDir: process.env.VERCEL
    ? ".next"
    : process.env.NODE_ENV === "production"
      ? ".next-build"
      : ".next",
  webpack(config) {
    // Monaco 0.55 pins an older sanitizer. Force its browser bundle to the patched release
    // until Monaco updates the transitive dependency itself.
    config.resolve.alias.dompurify = require.resolve("dompurify");
    return config;
  },
};

export default nextConfig;
