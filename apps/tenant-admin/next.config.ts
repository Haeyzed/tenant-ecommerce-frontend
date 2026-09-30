import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
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
