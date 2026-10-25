const supabaseImagePatterns = [];
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
  if (supabaseUrl?.protocol === "https:") {
    supabaseImagePatterns.push({
      protocol: "https",
      hostname: supabaseUrl.hostname,
      port: supabaseUrl.port,
      pathname: "/storage/v1/object/public/business-gallery/**",
    });
  }
} catch {
  // La app sigue operativa con imágenes locales/fallback si la URL pública no es válida.
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseImagePatterns,
  },
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
