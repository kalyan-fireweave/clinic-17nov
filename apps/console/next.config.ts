import { fireweaveDefine } from "@fireweaveai/web-sdk/define";
import type { NextConfig } from "next";

// Next stringifies compiler.define values. fireweaveDefine() already returns
// code, so parse it back to an object and let Next stringify once.
const fireweaveConfig = Object.fromEntries(
  Object.entries(fireweaveDefine()).map(([key, value]) => [key, JSON.parse(value)]),
);

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@clinic/ui"],
  compiler: { define: fireweaveConfig as Record<string, string> },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
