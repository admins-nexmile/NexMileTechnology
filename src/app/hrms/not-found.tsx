import Link from "next/link";

export default function HrmsNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">404</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          This page does not exist or you do not have access to it.
        </p>
        <Link
          href="/hrms"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
        >
          Back to the portal
        </Link>
      </div>
    </div>
  );
}
