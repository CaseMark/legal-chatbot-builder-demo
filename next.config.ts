import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack configuration for PDF.js worker
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
