import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  // Firebase Admin uses Node built-ins and dynamic requires; keep it out of
  // the webpack server bundle so its credentials/transport load correctly.
  serverExternalPackages: ["firebase-admin"],
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