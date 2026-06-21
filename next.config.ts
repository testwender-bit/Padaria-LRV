import type { NextConfig } from "next";

// ============================================================
// next.config.ts — Ajustado para deploy na Vercel
// ============================================================
// Mudanças v8.6:
//   - Mantido output: "standalone" (Vercel suporta e otimiza)
//   - allowedDevOrigins mantido (não atrapalha em prod)
//   - Adicionado serverExternalPackages: ["bcryptjs"]
//     Necessário porque bcryptjs usa APIs Node (crypto) que
//     não funcionam no runtime Edge; com isso, Vercel empacota
//     como Node externo na serverless function.
// ============================================================

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Permite previews cross-origin (Codespaces, preview-chats, etc.)
  allowedDevOrigins: [
    "*.app.github.dev",
    "*.space-z.ai",
    "*.preview.app.github.dev",
  ],
  // bcryptjs usa crypto nativo do Node — precisa ser marcado como
  // external para não ser bundlado pelo webpack (que quebraria no Edge).
  serverExternalPackages: ["bcryptjs"],
};

export default nextConfig;
