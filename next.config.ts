import type { NextConfig } from "next";
import { localModeFromEnvironment } from "./lib/local-mode";

localModeFromEnvironment(process.env);

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  devIndicators:
    process.env.GOOGLEDSA_UI_PREVIEW === "true" ? false : undefined,
  // Keep the isolated UI preview from sharing the normal dev server's files.
  distDir:
    process.env.GOOGLEDSA_UI_PREVIEW === "true" ? ".next-ui-preview" : ".next",
};

export default nextConfig;
