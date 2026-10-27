import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // Lets a second dev server run beside the first (e.g. against a test database) without the
  // two overwriting each other's build output. Unset in normal use.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
