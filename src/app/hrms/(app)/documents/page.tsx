import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/hrms/components/ui/card";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { labelFor } from "@/hrms/lib/admin/options";
import { requireEmployeeUser } from "@/hrms/lib/auth/guards";
import { DOCUMENT_CATEGORIES, listMyDocuments } from "@/hrms/lib/data/documents";
import { formatDateTime } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "My documents" };

export default function MyDocumentsPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="My documents" description="Documents HR has shared with you. Links expire after 60 seconds." />
      <Suspense fallback={<PageSkeleton label="Loading documents…" blocks={1} />}>
        <DocumentsContent />
      </Suspense>
    </div>
  );
}

async function DocumentsContent() {
  await requireEmployeeUser();
  const documents = await listMyDocuments();
  return (
    <Card>
      <CardHeader title="Documents" />
      {documents.length === 0 ? (
        <EmptyState>No documents have been shared with you.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-ink">{d.document_name}</p>
                <p className="text-xs text-ink-subtle">
                  {labelFor(DOCUMENT_CATEGORIES, d.document_category)} · {formatDateTime(d.uploaded_at)}
                </p>
              </div>
              {d.has_file ? (
                <a
                  href={`/hrms/documents/${d.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-700 hover:underline"
                >
                  Open<span className="sr-only"> {d.document_name}</span>
                </a>
              ) : (
                <span className="text-xs text-ink-subtle">No file attached</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
