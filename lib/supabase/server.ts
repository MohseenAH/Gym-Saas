import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cache } from "react";

export interface CachedUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // In Server Components, cookie setting might be restricted
        }
      },
    },
  });
});

export const getCachedUser = cache(async (): Promise<CachedUser | null> => {
  // 1. Check if user claims were already verified and injected by middleware
  try {
    const headerList = await headers();
    const verifiedUserRaw = headerList.get("x-verified-user");
    if (verifiedUserRaw) {
      const parsed = JSON.parse(verifiedUserRaw);
      if (parsed && typeof parsed.id === "string") {
        return {
          id: parsed.id,
          email: parsed.email || undefined,
          user_metadata: parsed.user_metadata || {},
        };
      }
    }
  } catch {
    // headers() might be unavailable or throw in certain non-render contexts
  }

  // 2. Local JWT / asymmetric verification via getClaims()
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) {
    const claims = data.claims;
    return {
      id: claims.sub as string,
      email: (claims.email as string) || undefined,
      user_metadata: (claims.user_metadata as Record<string, unknown>) || {},
    };
  }

  // 3. Fallback to getUser() if symmetric key or getClaims didn't resolve
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email || undefined,
    user_metadata: user.user_metadata || {},
  };
});
