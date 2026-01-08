import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack configuration (empty config to silence warning)
  turbopack: {},

  // Webpack configuration for PDF.js worker (fallback for non-Turbopack builds)
  webpack: (config) => {
    // Handle PDF.js worker
    config.resolve.alias.canvas = false;

    return config;
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
