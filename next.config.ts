import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/cnc.html",
      },
    ];
  },
};

export default nextConfig;
