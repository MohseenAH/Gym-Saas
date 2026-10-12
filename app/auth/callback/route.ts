import { createClient } from "@/lib/supabase/server";
import { resolvePostLoginRedirect } from "@/lib/auth/redirect";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const destination = await resolvePostLoginRedirect();
  return NextResponse.redirect(new URL(destination.path, requestUrl.origin));
}
