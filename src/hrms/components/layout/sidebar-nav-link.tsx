"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/hrms/components/ui/icons";
import { navLinkClasses } from "./nav-styles";

type SidebarNavLinkProps = {
  href: string;
  label: string;
  icon: IconName;
};

/** Client-only because it reads the current pathname for the active state. */
export function SidebarNavLink({ href, label, icon }: SidebarNavLinkProps) {
  const pathname = usePathname();
  const active = href === "/hrms" ? pathname === "/hrms" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={navLinkClasses(active)}
    >
      <Icon name={icon} className="size-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
