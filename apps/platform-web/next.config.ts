import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  transpilePackages: ["@workspace/ui", "@workspace/api-client", "@workspace/bff", "@workspace/contract", "@workspace/format"],
}

export default nextConfig
