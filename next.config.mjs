/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse가 서버 측에서 정상 동작하도록 외부 패키지로 지정
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
