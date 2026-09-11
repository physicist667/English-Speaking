import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ws (Edge TTS) и z-ai SDK не бандлим — внешние модули Node runtime
  serverExternalPackages: ["ws", "z-ai-web-dev-sdk"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicators: false,
};

export default nextConfig;
