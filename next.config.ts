import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      { source: "/partidos", destination: "/admin/partidos", permanent: false },
      { source: "/stories", destination: "/admin/stories", permanent: false },
      { source: "/eventos", destination: "/admin/eventos", permanent: false },
      { source: "/jobs", destination: "/admin/jobs", permanent: false },
      { source: "/controles", destination: "/admin/controles", permanent: false },
    ];
  },
};

export default nextConfig;
