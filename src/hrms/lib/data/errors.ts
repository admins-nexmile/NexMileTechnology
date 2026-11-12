import type { PostgrestError } from "@supabase/supabase-js";

export const GENERIC_ERROR =
  "Something went wrong. Please try again or contact an administrator.";

/**
 * Turns a database error into a message safe to show. Messages raised by
 * our own functions (P0001 / 42501 with a sentence) are shown; anything
 * else (constraint names, internal errors) becomes a generic message.
 */
export function toUserMessage(error: Pick<PostgrestError, "code" | "message"> | null): string {
  if (!error) return GENERIC_ERROR;
  const ownMessage =
    (error.code === "P0001" || error.code === "42501") &&
    !/^permission denied/i.test(error.message);
  return ownMessage ? error.message : GENERIC_ERROR;
}

/**
 * Set-returning RPCs come back as arrays. Generated database types are not
 * in use, so row shapes are asserted by the caller (mirroring the SQL).
 */
export function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

/** Throws a safe error for a failed read (renders the error boundary). */
export function throwIfError(error: Pick<PostgrestError, "code" | "message"> | null): void {
  if (error) throw new Error(toUserMessage(error));
}
