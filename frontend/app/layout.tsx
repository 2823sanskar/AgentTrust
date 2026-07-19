import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentTrust | Verified Trust for AI Agents",
  description: "Blockchain-backed execution verification and reputation platform for AI agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#f6f1e7] text-[#241c15] font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
