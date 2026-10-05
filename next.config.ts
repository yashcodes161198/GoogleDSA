import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the isolated UI preview from sharing the normal dev server's files.
  distDir:
    process.env.GOOGLEDSA_UI_PREVIEW === "true" ? ".next-ui-preview" : ".next",
};

export default nextConfig;
