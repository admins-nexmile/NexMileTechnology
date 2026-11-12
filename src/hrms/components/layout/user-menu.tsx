import Link from "next/link";
import { signOut } from "@/app/hrms/auth/actions";
import { Avatar } from "@/hrms/components/ui/avatar";
import { Dropdown } from "@/hrms/components/ui/dropdown";
import { Icon } from "@/hrms/components/ui/icons";
import type { HeaderUser } from "@/hrms/lib/types/hrms";

const itemClass =
  "flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none";

/**
 * Profile menu for the signed-in user. Name, email and role come from the
 * server-verified session (see getAccessState).
 */
export function UserMenu({ user, showProfile }: { user: HeaderUser; showProfile: boolean }) {
  return (
    <Dropdown
      label={`Account menu for ${user.name}`}
      triggerClassName="gap-2 py-1 pl-1 pr-2"
      trigger={
        <>
          <Avatar name={user.name} size="sm" />
          <span className="hidden text-left md:block">
            <span className="block text-sm font-medium leading-tight text-ink">{user.name}</span>
            <span className="block text-xs leading-tight text-ink-subtle">{user.role}</span>
          </span>
          <Icon name="chevronDown" className="hidden size-4 md:block" />
        </>
      }
      panelClassName="w-72"
    >
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink">{user.name}</p>
        <p className="truncate text-xs text-ink-subtle">{user.email}</p>
        <p className="mt-1 text-xs text-ink-muted">{user.role}</p>
      </div>
      <ul className="py-1">
        {showProfile ? (
          <li>
            <Link href="/hrms/profile" className={itemClass}>
              <Icon name="user" className="size-4" />
              My profile
            </Link>
          </li>
        ) : null}
        <li>
          <form action={signOut}>
            <button type="submit" className={itemClass}>
              <Icon name="logout" className="size-4" />
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </Dropdown>
  );
}
