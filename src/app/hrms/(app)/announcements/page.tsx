import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnouncementsList } from "@/hrms/components/dashboard/announcements-list";
import { PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requireActiveUser } from "@/hrms/lib/auth/guards";
import { getMyAnnouncements } from "@/hrms/lib/data/self-service";

export const metadata: Metadata = { title: "Announcements" };

export default function AnnouncementsPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Announcements" description="Company-wide and department announcements for you." />
      <Suspense fallback={<PageSkeleton label="Loading announcements…" blocks={1} />}>
        <AnnouncementsContent />
      </Suspense>
    </div>
  );
}

async function AnnouncementsContent() {
  await requireActiveUser();
  const announcements = await getMyAnnouncements(100);
  return <AnnouncementsList announcements={announcements} full />;
}
