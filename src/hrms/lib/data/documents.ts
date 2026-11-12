import "server-only";
import { createClient } from "@/hrms/lib/supabase/server";
import { asRows, throwIfError } from "./errors";

/**
 * Employee documents (migration 2.11). Files live in the PRIVATE bucket
 * "employee-documents"; they are only ever served through short-lived
 * signed URLs created with the signed-in user's session, so the storage
 * SELECT policy decides who can open each file.
 */
export const DOCUMENTS_BUCKET = "employee-documents";
export const SIGNED_URL_SECONDS = 60;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

export const DOCUMENT_CATEGORIES = [
  { value: "POLICY", label: "Policy" },
  { value: "CONTRACT", label: "Contract" },
  { value: "OFFER_LETTER", label: "Offer letter" },
  { value: "ID_PROOF", label: "ID proof" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "TAX", label: "Tax" },
  { value: "OTHER", label: "Other" },
];

export type MyDocument = {
  id: string;
  document_name: string;
  document_category: string;
  has_file: boolean;
  uploaded_at: string;
};

export type AdminDocument = MyDocument & {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  is_confidential: boolean;
};

export async function listMyDocuments(): Promise<MyDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_documents");
  throwIfError(error);
  return asRows<MyDocument>(data);
}

export async function listAllDocuments(employeeId?: string): Promise<AdminDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_documents", {
    p_employee_id: employeeId ?? null,
  });
  throwIfError(error);
  return asRows<AdminDocument>(data);
}

/**
 * Signed URL for a document the caller may open, or null. doc_get_path
 * checks own-and-not-confidential or employees.manage; createSignedUrl is
 * checked again by the storage policy.
 */
export async function createDocumentUrl(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("doc_get_path", { p_id: id });
  if (error || typeof path !== "string") return null;
  const { data, error: signError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signError || !data?.signedUrl) return null;
  return data.signedUrl;
}
