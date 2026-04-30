/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false,
  },
  // Lint kjører i CI/lokalt; vi vil ikke blokkere produksjonsbygg på lint-feil.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
