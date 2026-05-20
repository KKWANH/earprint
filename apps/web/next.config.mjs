/** @type {import('next').NextConfig} */
const nextConfig = {
  // 모노레포 내부 패키지(TS 소스)를 Next 빌드 파이프라인에서 트랜스파일.
  transpilePackages: ["@playlist-analyzer/shared"],
};

export default nextConfig;
