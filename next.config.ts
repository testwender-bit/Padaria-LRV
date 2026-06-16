import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Permite previews cross-origin (Codespaces, preview-chats, etc.)
  allowedDevOrigins: [
    "*.app.github.dev",
    "*.space-z.ai",
    "*.preview.app.github.dev",
  ],
};

export default nextConfig;
