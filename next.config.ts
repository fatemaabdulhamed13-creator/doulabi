import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apple fetches this extension-less file to verify app links and
        // requires it to be served as JSON.
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Cloudflare R2 default public bucket URL (pub-xxxx.r2.dev) — older listings still use it
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        // Custom domain on the same R2 bucket, used for uploads since the switch
        protocol: "https",
        hostname: "img.shopdoulabi.com",
      },
    ],
  },
};

export default nextConfig;
