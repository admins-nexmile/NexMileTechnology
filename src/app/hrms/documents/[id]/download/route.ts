import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/hrms/lib/actions/types";
import { getAccessState } from "@/hrms/lib/auth/session";
import { createDocumentUrl } from "@/hrms/lib/data/documents";

/**
 * Opens a document via a 60-second signed URL. Access is decided by the
 * database (doc_get_path) and the storage policy, both evaluated with the
 * caller's own session. Unknown or forbidden documents return 404.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/hrms/documents/[id]/download">) {
  const { id } = await ctx.params;
  const access = await getAccessState();
  if (access.status !== "active" || !isUuid(id)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = await createDocumentUrl(id);
  if (!url) return new NextResponse("Not found", { status: 404 });

  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
