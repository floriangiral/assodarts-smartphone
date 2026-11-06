import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@assodarts/shared"],
  // Preserve absolute cross-domain redirects when Next runs behind a proxy.
  skipProxyUrlNormalize: true,
};
export default config;
