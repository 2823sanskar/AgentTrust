import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    const backendApiUrl = (process.env.BACKEND_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
    const awsWorkerUrl = process.env.NEXT_PUBLIC_AWS_SANDBOX_URL;
    const rewrites = [
      {
        source: "/backend-api/:path*",
        destination: `${backendApiUrl}/:path*`,
      },
    ];

    if (process.env.NODE_ENV === "production" && awsWorkerUrl) {
      return [
        ...rewrites,
        {
          source: "/api/sandbox/:path*",
          destination: `${awsWorkerUrl.replace(/\/$/, "")}/api/sandbox/:path*`,
        },
      ];
    }

    return [
      ...rewrites,
      {
        source: "/api/sandbox/:path*",
        destination: "http://localhost:8000/api/sandbox/:path*",
      },
    ];
  },
};

export default nextConfig;
