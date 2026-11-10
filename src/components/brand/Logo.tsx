import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import logo from "../../../public/brand/nexmile-logo.png";

type LogoProps = {
  className?: string;
  /** Preload the image (use in the header, which is above the fold) */
  preload?: boolean;
};

/** Official NexmileTechnology logo, taken from the existing company website. */
export function Logo({ className = "h-9 w-auto", preload = false }: LogoProps) {
  return (
    <Link href="/" aria-label={`${siteConfig.name} home`} className="inline-flex shrink-0">
      <Image src={logo} alt={siteConfig.name} className={className} preload={preload} sizes="240px" />
    </Link>
  );
}
