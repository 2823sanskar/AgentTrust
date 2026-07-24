import Image from "next/image";

interface AgentTrustLogoProps {
  className?: string;
  priority?: boolean;
}

export function AgentTrustLogo({
  className = "h-auto w-44",
  priority = false,
}: AgentTrustLogoProps) {
  return (
    <Image
      src="/agenttrust-logo.png"
      alt="AgentTrust"
      width={1054}
      height={236}
      className={className}
      priority={priority}
    />
  );
}
