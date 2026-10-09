import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_URL || "http://127.0.0.1:8080"}/api/:path*` }];
  },
  poweredByHeader: false,
  devIndicators: false,
  images: {
    qualities: [75, 90],
    deviceSizes: [390, 640, 750, 828, 1080, 1280, 1536, 1920, 2560],
  },
};
export default nextConfig;
