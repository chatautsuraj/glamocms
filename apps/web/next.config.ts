import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion", "date-fns", "jspdf"],
  },
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
};

export default nextConfig;
