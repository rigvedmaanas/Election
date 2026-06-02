import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@heroui/react": path.resolve(__dirname, "/node_modules/@heroui/react"),
      "@heroui/styles$": path.resolve(
        __dirname,
        "/node_modules/@heroui/styles/dist/index.js",
      ),
    };

    return config;
  },
};

export default nextConfig;
