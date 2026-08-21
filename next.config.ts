import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify only accepts loopback IP literals as redirect URIs, so the OAuth
  // flow runs on 127.0.0.1 rather than localhost. Without this, the dev server
  // treats that as a foreign origin and blocks Fast Refresh there.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
