import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Protected paths: /app/*, /portal/*, /select-workspace, /onboarding
  const isProtectedPath =
    pathname.startsWith("/app") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/select-workspace") ||
    pathname.startsWith("/onboarding");

  // Auth pages: /login, /signup
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  // Check if any Supabase auth cookies are present
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.startsWith("sb-") || c.name.includes("auth-token")
  );

  // Fast path 1: Unauthenticated request to protected path -> redirect immediately without remote network roundtrip
  if (isProtectedPath && !hasAuthCookie) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Fast path 2: Public route without auth cookies -> skip remote network call completely
  if (!isProtectedPath && !isAuthPage && !hasAuthCookie) {
    return supabaseResponse;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/select-workspace";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
