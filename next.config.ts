import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A stray package-lock.json in the home folder confuses root detection.
  turbopack: { root: __dirname },
  // `npm run dev` opened on a tablet through a tunnel (Cloudflare quick tunnel or ngrok) (HTTPS, so the mic works there too).
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.dev"],
};

export default nextConfig;
