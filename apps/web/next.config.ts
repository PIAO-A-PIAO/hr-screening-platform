import type { NextConfig } from "next";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

// Next runs from apps/web when invoked through npm workspaces. Load the
// repository-level environment without overriding CI or hosting variables.
loadDotenv({ path: resolve(process.cwd(), "../../.env"), override: false });

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
