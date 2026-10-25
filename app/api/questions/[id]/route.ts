import { revalidatePath } from "next/cache";
import { getUser, isAdminUser } from "@/lib/auth";
import { isLocalMode } from "@/lib/config";
import { getMemoryStore } from "@/lib/memory/store";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin" }, { status: 403, headers });
  }

  try {
    const supabase = isLocalMode() ? null : await createClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : await getUser();
    if (!user) return Response.json({ error: "Not authenticated" }, { status: 401, headers });
    if (!isAdminUser(user)) {
      return Response.json({ error: "Only admins can delete questions" }, { status: 403, headers });
    }
    const { id } = await params;
    if (!isUuid(id)) return Response.json({ error: "Invalid question ID" }, { status: 400, headers });

    if (supabase) {
      const { data, error } = await supabase.from("problems").delete().eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return Response.json({ error: "Question not found" }, { status: 404, headers });
    } else if (!getMemoryStore().deleteProblem(id)) {
      return Response.json({ error: "Question not found" }, { status: 404, headers });
    }

    revalidatePath("/", "layout");
    return Response.json({ deleted: true, id }, { headers });
  } catch {
    return Response.json({ error: "Could not delete question" }, { status: 503, headers });
  }
}
