import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  transpilePackages: ['@ai-sdk', 'ai'],
};

export default nextConfig;
