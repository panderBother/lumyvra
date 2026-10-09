import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  images: {
    qualities: [75, 90],
    deviceSizes: [390, 640, 750, 828, 1080, 1280, 1536, 1920, 2560],
  },
};
export default nextConfig;
