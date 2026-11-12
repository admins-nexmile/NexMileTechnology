import { Suspense } from "react";
import Link from "next/link";
import { Icon } from "@/hrms/components/ui/icons";
import { visibleNavigation } from "@/hrms/lib/navigation";
import type { NavContext } from "@/hrms/lib/types/hrms";
import { BrandLogo } from "./brand-logo";
import { navLinkClasses } from "./nav-styles";
import { SidebarNavLink } from "./sidebar-nav-link";

/**
 * Sidebar contents, shared by the fixed desktop sidebar and the mobile
 * navigation dialog. Server component: only active-link detection runs
 * on the client. Shows only what the signed-in user can use.
 */
export function SidebarContent({ nav }: { nav: NavContext }) {
  const sections = visibleNavigation(nav);

  return (
    <div className="flex h-full flex-col bg-brand-950 text-white">
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
        <BrandLogo />
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <h2 className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </h2>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Suspense
                    fallback={
                      <Link href={item.href} className={navLinkClasses(false)}>
                        <Icon name={item.icon} className="size-5 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    }
                  >
                    <SidebarNavLink href={item.href} label={item.label} icon={item.icon} />
                  </Suspense>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-5 py-4">
        <p className="text-xs leading-relaxed text-slate-400">Nexmile Technology HRMS</p>
      </div>
    </div>
  );
}
