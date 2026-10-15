import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { resolvePostLoginRedirect } from "@/lib/auth/redirect";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next =
    requestUrl.searchParams.get("next") ||
    requestUrl.searchParams.get("redirect");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const cookieStore = await cookies();
  const cookiesToSetLater: Array<{
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Ignore if setting in cookieStore fails
          }
          cookiesToSetLater.push({ name, value, options });
        });
      },
    },
  });

  let sessionUser = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Auth callback code exchange error:", error.message);
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(error.message)}`,
          requestUrl.origin
        )
      );
    }
    sessionUser = data.session?.user || null;
  } else {
    // If no code, check for existing session
    const { data } = await supabase.auth.getUser();
    sessionUser = data?.user || null;
  }

  if (!sessionUser) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  // Determine post-login redirect path
  let targetPath = next;
  if (!targetPath || targetPath === "/" || targetPath === "/select-workspace") {
    try {
      const cachedUser = {
        id: sessionUser.id,
        email: sessionUser.email,
        user_metadata: sessionUser.user_metadata,
      };
      const destination = await resolvePostLoginRedirect(supabase, cachedUser);
      targetPath = destination.path;
    } catch (err) {
      console.error("Error resolving post-login redirect destination:", err);
      targetPath = "/select-workspace";
    }
  }

  const response = NextResponse.redirect(new URL(targetPath, requestUrl.origin));

  // Explicitly set all cookies on the NextResponse redirect object
  cookiesToSetLater.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
