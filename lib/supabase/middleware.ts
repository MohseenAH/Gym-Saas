import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Strip incoming x-verified-user header to prevent spoofing
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-verified-user");

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const pathname = request.nextUrl.pathname;

  // Fast path 0: Static assets, manifest, service worker, and prefetch requests skip remote claims verification
  const isPrefetch =
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("x-purpose") === "prefetch" ||
    request.headers.get("next-router-prefetch") === "1";

  const isStaticOrPwaAsset =
    pathname.startsWith("/_next") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".ttf");

  if (isStaticOrPwaAsset || isPrefetch) {
    return supabaseResponse;
  }

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
          request: {
            headers: requestHeaders,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Verify claims locally or with minimal hop
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const user =
    claims && claims.sub
      ? {
          id: claims.sub as string,
          email: (claims.email as string) || undefined,
          user_metadata: (claims.user_metadata as Record<string, unknown>) || {},
        }
      : null;

  if (user) {
    requestHeaders.set(
      "x-verified-user",
      JSON.stringify({
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      })
    );

    const existingCookies = supabaseResponse.cookies.getAll();
    supabaseResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    existingCookies.forEach((c) => supabaseResponse.cookies.set(c));
  }

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

  // Track last visited gym for instant zero-waterfall PWA opens
  const appMatch = pathname.match(/^\/app\/([a-zA-Z0-9_-]+)/);
  if (appMatch && appMatch[1] && appMatch[1] !== "loading" && appMatch[1] !== "dashboard") {
    supabaseResponse.cookies.set("gymapra_last_gym_id", appMatch[1], {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return supabaseResponse;
}
