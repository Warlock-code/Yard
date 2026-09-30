import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react", "recharts"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.ufs.sh" },
      { protocol: "https", hostname: "utfs.io" },
    ],
    unoptimized: true,
  },
  output: "standalone",
}

export default nextConfig