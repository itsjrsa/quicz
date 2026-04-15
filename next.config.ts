import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Custom server handles HTTP — disable Next.js standalone output interference
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
