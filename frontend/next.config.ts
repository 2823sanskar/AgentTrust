import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    const awsWorkerUrl = process.env.NEXT_PUBLIC_AWS_SANDBOX_URL;

    if (process.env.NODE_ENV === "production" && awsWorkerUrl) {
      return [
        {
          source: "/api/sandbox/:path*",
          destination: `${awsWorkerUrl.replace(/\/$/, "")}/api/sandbox/:path*`,
        },
      ];
    }

    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:8000/health",
      },
      {
        source: "/docs",
        destination: "http://127.0.0.1:8000/docs",
      },
      {
        source: "/openapi.json",
        destination: "http://127.0.0.1:8000/openapi.json",
      },
      {
        source: "/api/sandbox/:path*",
        destination: "http://127.0.0.1:8000/api/sandbox/:path*",
      },
    ];
  },
};

export default nextConfig;
