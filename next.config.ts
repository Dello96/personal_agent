import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "k.kakaocdn.net",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "k.kakaocdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.kakaocdn.net",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "*.kakaocdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "personal-agent-bucket.s3.us-east-2.amazonaws.com",
        pathname: "/**",
      },
    ],
    domains: ["openweathermap.org"],
  },
};

export default nextConfig;
