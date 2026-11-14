import { NextRequest, NextResponse } from "next/server";
import {
  createPlanAction,
  updatePlanAction,
  togglePlanAction,
  deletePlanAction,
} from "@/lib/actions/plans";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createPlanAction(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to create plan" },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if toggle action (has isActive and planId, but lacks full plan fields)
    if (
      typeof body.isActive === "boolean" &&
      body.planId &&
      !body.name &&
      body.durationDays === undefined
    ) {
      const result = await togglePlanAction({
        gymId: body.gymId,
        planId: body.planId,
        isActive: body.isActive,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || "Failed to toggle plan" },
          { status: 400 }
        );
      }

      return NextResponse.json(result, { status: 200 });
    }

    // Standard plan update
    const result = await updatePlanAction(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to update plan" },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await deletePlanAction(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to delete plan" },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
