/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false,
  },
  // Lint kjører i CI/lokalt; vi vil ikke blokkere produksjonsbygg på lint-feil.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Samme for TS — vi sjekker typer lokalt med `npm run typecheck`.
  // Dette er pragmatisk under MVP-fase pga. Supabase-typer som krever
  // hyppig regenerering. Slå på igjen før V1 prod-launch.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
