"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { getUserWithPermission } from "@/hrms/lib/auth/guards";
import { PERMISSIONS } from "@/hrms/lib/auth/permissions";
import { NOT_ALLOWED, formString, isUuid, type ActionState } from "@/hrms/lib/actions/types";
import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENTS_BUCKET,
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
} from "@/hrms/lib/data/documents";
import { toUserMessage } from "@/hrms/lib/data/errors";
import { createClient } from "@/hrms/lib/supabase/server";

/**
 * HR document actions. Uploads use the HR user's own session; the storage
 * INSERT policy (employees.manage + employee folder) and doc_register
 * enforce access. No service-role key is involved.
 */

function safeFileName(name: string): string {
  const base = name.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
  return base.slice(-80) || "document";
}

export async function uploadDocumentAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getUserWithPermission(PERMISSIONS.employeesManage))) return NOT_ALLOWED;

  const employeeId = formString(formData, "employee_id");
  const name = formString(formData, "document_name");
  const category = formString(formData, "document_category");
  const confidential = formData.get("is_confidential") === "on";
  const file = formData.get("file");

  if (!isUuid(employeeId)) return { ok: false, message: "Choose an employee." };
  if (!name || name.length > 200) return { ok: false, message: "Enter a document name (up to 200 characters)." };
  if (!DOCUMENT_CATEGORIES.some((c) => c.value === category)) return { ok: false, message: "Choose a category." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file to upload." };
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, message: "Files can be at most 10 MB." };
  if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, message: "Only PDF, PNG or JPEG files are allowed." };
  }

  const path = `${employeeId}/${randomUUID()}-${safeFileName(file.name)}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, message: "The file could not be uploaded. Please try again." };

  const { error } = await supabase.rpc("doc_register", {
    p_employee_id: employeeId,
    p_name: name,
    p_category: category,
    p_storage_path: path,
    p_is_confidential: confidential,
  });
  if (error) {
    // Do not leave an unregistered file behind.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    return { ok: false, message: toUserMessage(error) };
  }
  refresh();
  return { ok: true, message: "Document uploaded." };
}

export async function setConfidentialAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getUserWithPermission(PERMISSIONS.employeesManage))) return NOT_ALLOWED;
  const id = formString(formData, "id");
  if (!isUuid(id)) return { ok: false, message: "Invalid document." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("doc_set_confidential", {
    p_id: id,
    p_is_confidential: formString(formData, "confidential") === "true",
  });
  if (error) return { ok: false, message: toUserMessage(error) };
  refresh();
  return { ok: true, message: "Visibility updated." };
}

export async function deleteDocumentAction(_p: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getUserWithPermission(PERMISSIONS.employeesManage))) return NOT_ALLOWED;
  const id = formString(formData, "id");
  if (!isUuid(id)) return { ok: false, message: "Invalid document." };
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("doc_delete", { p_id: id });
  if (error) return { ok: false, message: toUserMessage(error) };
  if (typeof path === "string" && path) {
    const { error: removeError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    if (removeError) {
      refresh();
      return { ok: false, message: "The record was deleted but the file could not be removed. Ask an administrator to remove it from Storage." };
    }
  }
  refresh();
  return { ok: true, message: "Document deleted." };
}
