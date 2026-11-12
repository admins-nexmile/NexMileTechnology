import type { Metadata } from "next";
import { Suspense } from "react";
import { EnrollmentList } from "@/hrms/components/training/enrollment-list";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { requireEmployeeUser } from "@/hrms/lib/auth/guards";
import { getActiveCourses, getMyEnrollments } from "@/hrms/lib/data/self-service";

export const metadata: Metadata = { title: "Training" };

export default function TrainingPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Training" description="Your assigned courses and the course catalogue." />
      <Suspense fallback={<PageSkeleton label="Loading training…" />}>
        <TrainingContent />
      </Suspense>
    </div>
  );
}

async function TrainingContent() {
  const user = await requireEmployeeUser();
  const [enrollments, courses] = await Promise.all([
    getMyEnrollments(user.employeeId),
    getActiveCourses(),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3" aria-labelledby="my-training-heading">
        <CardHeader
          titleId="my-training-heading"
          title="My training"
          description="Start a course, then mark it completed when you finish."
        />
        <EnrollmentList enrollments={enrollments} />
      </Card>
      <Card className="self-start lg:col-span-2" aria-labelledby="catalogue-heading">
        <CardHeader
          titleId="catalogue-heading"
          title="Course catalogue"
          description="Active courses. HR assigns courses to employees."
        />
        {courses.length === 0 ? (
          <EmptyState>No active courses.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {courses.map((c) => (
              <li key={c.id} className="px-5 py-3 text-sm">
                <p className="font-medium text-ink">
                  {c.title} {c.is_mandatory ? <Badge tone="warning">Mandatory</Badge> : null}
                </p>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {[c.category, c.duration_hours ? `${c.duration_hours} h` : null].filter(Boolean).join(" · ")}
                </p>
                {c.description ? <p className="mt-1 text-ink-muted">{c.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
