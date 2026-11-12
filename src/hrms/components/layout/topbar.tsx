import type { HeaderUser, NavContext } from "@/hrms/lib/types/hrms";
import { BrandLogo } from "./brand-logo";
import { MobileNav } from "./mobile-nav";
import { SidebarContent } from "./sidebar";
import { UserMenu } from "./user-menu";

export function Topbar({ user, nav }: { user: HeaderUser; nav: NavContext }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8 print:hidden">
      <MobileNav>
        <SidebarContent nav={nav} />
      </MobileNav>

      <BrandLogo variant="dark" className="sm:hidden" />

      <div className="flex flex-1 items-center" />

      <div className="flex items-center gap-1 sm:gap-2">
        <UserMenu user={user} showProfile={nav.hasEmployee} />
      </div>
    </header>
  );
}
