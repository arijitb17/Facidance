import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Allow production builds even if there are ESLint warnings or errors
  eslint: {
    ignoreDuringBuilds: true,
  },

  /* other config options here */
};

export default nextConfig;
