import type { Metadata } from "next";
import { Suspense } from "react";
import { deleteDocumentAction, setConfidentialAction } from "@/app/hrms/(app)/admin/documents/actions";
import { UploadDocumentForm } from "@/hrms/components/admin/documents/upload-document-form";
import { Badge } from "@/hrms/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/hrms/components/ui/card";
import { ActionButton } from "@/hrms/components/ui/form";
import { EmptyState, PageSkeleton, PageTitle } from "@/hrms/components/ui/page-title";
import { labelFor } from "@/hrms/lib/admin/options";
import { requirePagePermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { listEmployees } from "@/hrms/lib/data/admin";
import { DOCUMENT_CATEGORIES, listAllDocuments } from "@/hrms/lib/data/documents";
import { formatDateTime } from "@/hrms/lib/utils/format";

export const metadata: Metadata = { title: "Manage documents" };

export default function ManageDocumentsPage() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Manage documents"
        description="Files are stored privately and opened through links that expire after 60 seconds."
      />
      <Suspense fallback={<PageSkeleton label="Loading documents…" />}>
        <DocumentsContent />
      </Suspense>
    </div>
  );
}

async function DocumentsContent() {
  await requirePagePermission(PERMISSIONS.employeesManage);
  const [documents, employees] = await Promise.all([listAllDocuments(), listEmployees()]);
  const employeeOptions = employees.map((e) => ({ value: e.id, label: `${e.employee_code} — ${e.name}` }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="All documents" description={`${documents.length} document(s)`} />
        {documents.length === 0 ? (
          <EmptyState>No documents yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {d.has_file ? (
                      <a href={`/hrms/documents/${d.id}/download`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                        {d.document_name}
                      </a>
                    ) : (
                      d.document_name
                    )}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {d.employee_code} — {d.employee_name} · {labelFor(DOCUMENT_CATEGORIES, d.document_category)} ·{" "}
                    {formatDateTime(d.uploaded_at)}
                    {d.has_file ? "" : " · no file attached"}
                  </p>
                  <div className="mt-1">
                    {d.is_confidential ? <Badge tone="warning">Confidential (HR only)</Badge> : <Badge tone="success">Visible to employee</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    action={setConfidentialAction}
                    fields={{ id: d.id, confidential: String(!d.is_confidential) }}
                    pendingLabel="Saving…"
                    confirmMessage={d.is_confidential ? `Let ${d.employee_name} see "${d.document_name}"?` : `Make "${d.document_name}" HR-only?`}
                  >
                    {d.is_confidential ? "Share with employee" : "Make confidential"}
                  </ActionButton>
                  <ActionButton
                    action={deleteDocumentAction}
                    fields={{ id: d.id }}
                    pendingLabel="Deleting…"
                    confirmMessage={`Delete "${d.document_name}" and its file? This cannot be undone.`}
                    ariaLabel={`Delete ${d.document_name}`}
                  >
                    Delete
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="self-start">
        <CardHeader title="Upload document" />
        <CardBody>
          <UploadDocumentForm employees={employeeOptions} categories={DOCUMENT_CATEGORIES} />
        </CardBody>
      </Card>
    </div>
  );
}
