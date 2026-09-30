import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: { position: "bottom-left" },
  transpilePackages: [
    "@workspace/ui",
    "@workspace/admin-kit",
    "@workspace/access",
    "@workspace/api-client",
    "@workspace/bff",
    "@workspace/contract",
    "@workspace/format",
  ],
}

export default nextConfig