import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the floating Next.js developer badge in the corner while developing. It never appears in production.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
