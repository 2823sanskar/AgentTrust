import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    const awsWorkerUrl = process.env.NEXT_PUBLIC_AWS_SANDBOX_URL;
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const apiOrigin = rawApiUrl ? rawApiUrl.replace(/\/api\/?$/, "") : "";
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || apiOrigin || "http://127.0.0.1:8000";
    const backendBase = backendUrl.replace(/\/$/, "");
    const rewrites = [
      {
        source: "/api/:path*",
        destination: `${backendBase}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendBase}/health`,
      },
      {
        source: "/docs",
        destination: `${backendBase}/docs`,
      },
      {
        source: "/openapi.json",
        destination: `${backendBase}/openapi.json`,
      },
    ];

    if (awsWorkerUrl) {
      return [
        {
          source: "/api/sandbox/:path*",
          destination: `${awsWorkerUrl.replace(/\/$/, "")}/api/sandbox/:path*`,
        },
        ...rewrites,
      ];
    }

    return rewrites;
  },
};

export default nextConfig;
