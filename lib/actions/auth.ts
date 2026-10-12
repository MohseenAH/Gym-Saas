"use server";

import { createClient } from "@/lib/supabase/server";
import { resolvePostLoginRedirect } from "@/lib/auth/redirect";
import { redirect } from "next/navigation";
import { z } from "zod";

const signupSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  gymName: z.string().min(2, "Gym name must be at least 2 characters"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function signupOwnerAction(formData: FormData) {
  const rawData = {
    fullName: formData.get("fullName") as string,
    gymName: formData.get("gymName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    password: formData.get("password") as string,
  };

  const validation = signupSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const { fullName, gymName, email, phone, password } = validation.data;
  const supabase = await createClient();

  // 1. Try signing in first in case account was already created in earlier attempt
  let user: any = null;
  const { data: directSignIn } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (directSignIn?.user && directSignIn?.session) {
    user = directSignIn.user;
  } else {
    // 2. Attempt signUp
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });

    if (authError) {
      if (authError.message.includes("rate limit") || authError.message.includes("security purposes")) {
        return {
          success: false,
          error: "Supabase email rate limit reached. Please disable 'Confirm email' in Supabase Dashboard (Authentication > Providers > Email) for instant local development.",
        };
      }
      return { success: false, error: authError.message };
    }

    user = authData?.user;

    // If signUp succeeded but session is null (email confirmation is enabled)
    if (!authData?.session) {
      const { data: retrySignIn, error: retrySignInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (retrySignInErr) {
        if (retrySignInErr.message.toLowerCase().includes("email not confirmed")) {
          return {
            success: false,
            error: "Email confirmation is enabled in your Supabase project. Please either confirm the email sent to your inbox, OR disable 'Confirm email' in Supabase Dashboard (Authentication > Providers > Email) for instant development signup.",
          };
        }
        return { success: false, error: retrySignInErr.message };
      }
      user = retrySignIn?.user;
    }
  }

  if (!user) {
    return { success: false, error: "Authentication required to initialize workspace" };
  }

  // 3. Call Single-Step Provisioning RPC
  const { data: provisionData, error: provisionError } = await supabase.rpc(
    "create_owner_account",
    {
      p_name: fullName,
      p_phone: phone,
      p_gym_name: gymName,
    }
  );

  if (provisionError) {
    if (provisionError.message.includes("Owner account already exists")) {
      const destination = await resolvePostLoginRedirect();
      redirect(destination.path);
    }
    return {
      success: false,
      error: provisionError.message || "Failed to provision gym workspace",
    };
  }

  const gymId = (provisionData as any)?.gym_id;
  if (gymId) {
    redirect(`/app/${gymId}/dashboard`);
  }

  redirect("/select-workspace");
}

const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

export async function loginAction(formData: FormData) {
  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const validation = loginSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid credentials",
    };
  }

  const { email, password } = validation.data;
  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return {
      success: false,
      error: signInError.message || "Invalid email or password",
    };
  }

  // Dynamic persona routing
  const destination = await resolvePostLoginRedirect();
  redirect(destination.path);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
