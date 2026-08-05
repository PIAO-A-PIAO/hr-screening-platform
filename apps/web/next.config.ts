import type { NextConfig } from "next";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

loadDotenv({ path: resolve(process.cwd(), "../../.env"), override: false });

const nextConfig: NextConfig = {};

export default nextConfig;
