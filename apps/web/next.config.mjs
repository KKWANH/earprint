/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the monorepo-internal package (TS source) in Next's build pipeline.
  transpilePackages: ["@playlist-analyzer/shared"],
};

export default nextConfig;
