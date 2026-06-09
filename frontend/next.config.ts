import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      { source: '/api-auth/:path*', destination: 'http://localhost:8000/:path*' },
      { source: '/admin-api/:path*', destination: 'http://localhost:8001/:path*' },
      { source: '/teacher-api/:path*', destination: 'http://localhost:8002/:path*' },
      { source: '/student-api/:path*', destination: 'http://localhost:8003/:path*' },
      { source: '/face-api/:path*', destination: 'http://localhost:8004/:path*' },
    ];
  }
};

export default nextConfig;