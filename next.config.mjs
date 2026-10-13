/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["mjml", "mjml-core", "@google/genai", "resend"],
  },
  webpack: (config) => {
    config.resolve.alias = { ...(config.resolve.alias ?? {}), canvas: false };
    return config;
  },
};

export default nextConfig;
