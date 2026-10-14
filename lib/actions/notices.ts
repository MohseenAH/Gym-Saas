"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";

const createNoticeSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID").optional().nullable(),
  title: z.string().min(3, "Title must be at least 3 characters").max(120),
  content: z.string().min(5, "Content must be at least 5 characters").max(2000),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
  expiresAt: z.string().optional().nullable(),
});

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;

export async function createNoticeAction(input: CreateNoticeInput) {
  try {
    const validated = createNoticeSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "notices:manage",
      targetBranchId: validated.branchId || undefined,
    });

    const supabase = await createClient();

    const { data: notice, error } = await supabase
      .from("notices")
      .insert({
        gym_id: context.gymId,
        branch_id: validated.branchId || null,
        title: validated.title,
        content: validated.content,
        priority: validated.priority,
        expires_at: validated.expiresAt ? new Date(validated.expiresAt).toISOString() : null,
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: `Failed to post notice: ${error.message}` };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/notices`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/portal/${context.gymId}/dashboard`);
    revalidatePath(`/portal/${context.gymId}/notices`);

    return { success: true, noticeId: notice.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to post notice";
    return { success: false, error: message };
  }
}

export async function toggleNoticeAction(params: { gymId: string; noticeId: string; isActive: boolean }) {
  try {
    const context = await getAuthorizedActionContext({
      gymId: params.gymId,
      capability: "notices:manage",
    });

    const supabase = await createClient();

    const { error } = await supabase
      .from("notices")
      .update({ is_active: params.isActive, updated_at: new Date().toISOString() })
      .eq("id", params.noticeId)
      .eq("gym_id", context.gymId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/notices`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/portal/${context.gymId}/dashboard`);
    revalidatePath(`/portal/${context.gymId}/notices`);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update notice status";
    return { success: false, error: message };
  }
}

export async function deleteNoticeAction(params: { gymId: string; noticeId: string }) {
  try {
    const context = await getAuthorizedActionContext({
      gymId: params.gymId,
      capability: "notices:manage",
    });

    const supabase = await createClient();

    const { error } = await supabase
      .from("notices")
      .delete()
      .eq("id", params.noticeId)
      .eq("gym_id", context.gymId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/notices`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/portal/${context.gymId}/dashboard`);
    revalidatePath(`/portal/${context.gymId}/notices`);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete notice";
    return { success: false, error: message };
  }
}
