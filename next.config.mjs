/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "@libsql/client",
    "@react-pdf/renderer",
    "exceljs",
  ],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
