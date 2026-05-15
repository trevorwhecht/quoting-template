import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow all remote image sources — restrict to known domains in production
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
