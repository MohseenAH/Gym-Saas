


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_invitation"("p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_inv RECORD;
  v_gym_user_id UUID;
  v_branch_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = p_token_hash
    AND status = 'pending'
    AND expires_at > now();

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- CASE A: Member Portal Claim
  IF v_inv.role = 'member' THEN
    IF v_inv.member_id IS NULL THEN
      RAISE EXCEPTION 'Member ID missing from invitation';
    END IF;

    UPDATE public.members
    SET user_id = v_user_id,
        email = COALESCE(public.members.email, v_user_email),
        updated_at = now()
    WHERE id = v_inv.member_id;

    UPDATE public.invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_inv.id;

    RETURN jsonb_build_object('success', true, 'type', 'member', 'gym_id', v_inv.gym_id, 'member_id', v_inv.member_id);
  END IF;

  -- CASE B: Staff Role
  INSERT INTO public.gym_users (gym_id, user_id, role, status)
  VALUES (v_inv.gym_id, v_user_id, v_inv.role, 'active')
  ON CONFLICT (gym_id, user_id) DO UPDATE
  SET role = EXCLUDED.role, status = 'active', updated_at = now()
  RETURNING id INTO v_gym_user_id;

  IF v_inv.branch_ids IS NOT NULL AND array_length(v_inv.branch_ids, 1) > 0 THEN
    FOREACH v_branch_id IN ARRAY v_inv.branch_ids
    LOOP
      INSERT INTO public.user_branch_access (gym_user_id, branch_id)
      VALUES (v_gym_user_id, v_branch_id)
      ON CONFLICT (gym_user_id, branch_id) DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'type', 'staff', 'gym_id', v_inv.gym_id, 'role', v_inv.role);
END;
$$;


ALTER FUNCTION "public"."accept_invitation"("p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_member_claim_v2"("p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN RETURN public.accept_invitation(p_token_hash); END;
$$;


ALTER FUNCTION "public"."accept_member_claim_v2"("p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_staff_invitation_v2"("p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN RETURN public.accept_invitation(p_token_hash); END;
$$;


ALTER FUNCTION "public"."accept_staff_invitation_v2"("p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_owner_account"("p_name" "text", "p_gym_name" "text", "p_phone" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_gym_id UUID;
  v_branch_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (v_user_id, p_name, p_phone)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      updated_at = now();

  -- Prevent duplicate owner account
  SELECT id INTO v_account_id FROM public.accounts WHERE owner_id = v_user_id LIMIT 1;
  IF v_account_id IS NOT NULL THEN
    SELECT id INTO v_gym_id FROM public.gyms WHERE account_id = v_account_id LIMIT 1;
    SELECT id INTO v_branch_id FROM public.branches WHERE gym_id = v_gym_id LIMIT 1;
    RETURN jsonb_build_object(
      'account_id', v_account_id,
      'gym_id', v_gym_id,
      'branch_id', v_branch_id
    );
  END IF;

  -- Create SaaS account
  INSERT INTO public.accounts (owner_id, subscription_tier)
  VALUES (v_user_id, 'starter')
  RETURNING id INTO v_account_id;

  -- Create Gym
  INSERT INTO public.gyms (account_id, name, phone)
  VALUES (v_account_id, p_gym_name, p_phone)
  RETURNING id INTO v_gym_id;

  -- Create Main Branch
  INSERT INTO public.branches (gym_id, name)
  VALUES (v_gym_id, 'Main Branch')
  RETURNING id INTO v_branch_id;

  -- Create Owner membership in gym_users
  INSERT INTO public.gym_users (gym_id, user_id, role, status)
  VALUES (v_gym_id, v_user_id, 'owner', 'active');

  RETURN jsonb_build_object(
    'account_id', v_account_id,
    'gym_id', v_gym_id,
    'branch_id', v_branch_id
  );
END;
$$;


ALTER FUNCTION "public"."create_owner_account"("p_name" "text", "p_gym_name" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_owner_account_v2"("p_full_name" "text", "p_gym_name" "text", "p_phone" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  RETURN public.create_owner_account(p_full_name, p_gym_name, p_phone);
END;
$$;


ALTER FUNCTION "public"."create_owner_account_v2"("p_full_name" "text", "p_gym_name" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_member_branch_id"("p_member_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT m.branch_id FROM public.members m WHERE m.id = p_member_id;
$$;


ALTER FUNCTION "public"."get_member_branch_id"("p_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_branch_access"("p_branch_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = p_branch_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.gyms g
          JOIN public.accounts a ON a.id = g.account_id
          WHERE g.id = b.gym_id AND a.owner_id = COALESCE(p_user_id, (select auth.uid()))
        )
        OR
        EXISTS (
          SELECT 1
          FROM public.gym_users gu
          WHERE gu.gym_id = b.gym_id
            AND gu.user_id = COALESCE(p_user_id, (select auth.uid()))
            AND gu.status = 'active'
            AND (
              gu.role IN ('owner', 'partner')
              OR EXISTS (
                SELECT 1 FROM public.user_branch_access uba
                WHERE uba.gym_user_id = gu.id AND uba.branch_id = b.id
              )
            )
        )
      )
  );
$$;


ALTER FUNCTION "public"."has_branch_access"("p_branch_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_gym_owner"("p_gym_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gyms g
    JOIN public.accounts a ON a.id = g.account_id
    WHERE g.id = p_gym_id AND a.owner_id = COALESCE(p_user_id, (select auth.uid()))
  ) OR EXISTS (
    SELECT 1 FROM public.gym_users gu
    WHERE gu.gym_id = p_gym_id
      AND gu.user_id = COALESCE(p_user_id, (select auth.uid()))
      AND gu.role IN ('owner', 'partner')
      AND gu.status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_gym_owner"("p_gym_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_gym_staff"("p_gym_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gym_users gu
    WHERE gu.gym_id = p_gym_id
      AND gu.user_id = COALESCE(p_user_id, (select auth.uid()))
      AND gu.status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_gym_staff"("p_gym_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_owner"("p_member_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = p_member_id AND m.user_id = COALESCE(p_user_id, (select auth.uid()))
  );
$$;


ALTER FUNCTION "public"."is_member_owner"("p_member_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_gym_id_from_branch"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.gym_id IS NULL AND NEW.branch_id IS NOT NULL THEN
    SELECT gym_id INTO NEW.gym_id FROM public.branches WHERE id = NEW.branch_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_gym_id_from_branch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_memberships_gym_and_branch"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (NEW.gym_id IS NULL OR NEW.branch_id IS NULL) AND NEW.member_id IS NOT NULL THEN
    SELECT branch_id, gym_id INTO NEW.branch_id, NEW.gym_id FROM public.members WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_memberships_gym_and_branch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inv RECORD;
  v_gym_name TEXT;
  v_member_name TEXT;
BEGIN
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = p_token_hash
    AND status = 'pending'
    AND expires_at > now();

  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation expired or not found');
  END IF;

  SELECT name INTO v_gym_name FROM public.gyms WHERE id = v_inv.gym_id;

  IF v_inv.role = 'member' AND v_inv.member_id IS NOT NULL THEN
    SELECT full_name INTO v_member_name FROM public.members WHERE id = v_inv.member_id;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', v_inv.id,
    'gym_id', v_inv.gym_id,
    'gym_name', v_gym_name,
    'type', v_inv.type,
    'role', v_inv.role,
    'member_id', v_inv.member_id,
    'member_name', v_member_name,
    'email', v_inv.email,
    'phone', v_inv.phone
  );
END;
$$;


ALTER FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_invitation_token_v2"("p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN RETURN public.verify_invitation_token(p_token_hash); END;
$$;


ALTER FUNCTION "public"."verify_invitation_token_v2"("p_token_hash" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "subscription_tier" "text" DEFAULT 'starter'::"text" NOT NULL,
    "trial_ends_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "accounts_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['starter'::"text", 'pro'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "check_in_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "check_in_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "check_in_method" "text" DEFAULT 'staff_manual'::"text" NOT NULL,
    "verified_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gym_id" "uuid",
    "status" "text" DEFAULT 'checked_in'::"text",
    CONSTRAINT "attendance_check_in_method_check" CHECK (("check_in_method" = ANY (ARRAY['staff_manual'::"text", 'member_portal'::"text", 'kiosk_qr'::"text", 'biometric'::"text"])))
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gym_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Main Branch'::"text" NOT NULL,
    "code" "text",
    "address" "text",
    "city" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gym_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "expense_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_method" "text" DEFAULT 'cash'::"text" NOT NULL,
    "description" "text",
    "receipt_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'recorded'::"text",
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "expenses_category_check" CHECK (("category" = ANY (ARRAY['rent'::"text", 'electricity'::"text", 'salaries'::"text", 'equipment'::"text", 'maintenance'::"text", 'marketing'::"text", 'miscellaneous'::"text", 'other'::"text"]))),
    CONSTRAINT "expenses_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'bank_transfer'::"text", 'upi'::"text", 'card'::"text", 'cheque'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gym_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gym_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gym_users_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'partner'::"text", 'manager'::"text", 'staff'::"text", 'trainer'::"text"]))),
    CONSTRAINT "gym_users_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."gym_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gyms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gyms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gym_id" "uuid" NOT NULL,
    "email" "text",
    "phone" "text",
    "type" "text" DEFAULT 'staff'::"text" NOT NULL,
    "role" "text" NOT NULL,
    "branch_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "member_id" "uuid",
    "token_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by" "uuid",
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invitations_role_check" CHECK (("role" = ANY (ARRAY['partner'::"text", 'manager'::"text", 'staff'::"text", 'trainer'::"text", 'member'::"text"]))),
    CONSTRAINT "invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'revoked'::"text"]))),
    CONSTRAINT "invitations_type_check" CHECK (("type" = ANY (ARRAY['staff'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "avatar_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gym_id" "uuid",
    CONSTRAINT "members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membership_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "duration_days" integer NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "membership_plans_duration_days_check" CHECK (("duration_days" > 0)),
    CONSTRAINT "membership_plans_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."membership_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gym_id" "uuid",
    "branch_id" "uuid",
    CONSTRAINT "memberships_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'frozen'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "valid_date_range" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gym_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notices_priority_check" CHECK (("priority" = ANY (ARRAY['normal'::"text", 'important'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gym_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "membership_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "payment_method" "text" DEFAULT 'cash'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'paid'::"text" NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'paid'::"text",
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'upi'::"text", 'card'::"text", 'bank_transfer'::"text", 'cheque'::"text", 'other'::"text"]))),
    CONSTRAINT "payments_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['paid'::"text", 'partial'::"text", 'pending'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_branch_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gym_user_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_branch_access" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_member_id_check_in_date_key" UNIQUE ("member_id", "check_in_date");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gym_users"
    ADD CONSTRAINT "gym_users_gym_id_user_id_key" UNIQUE ("gym_id", "user_id");



ALTER TABLE ONLY "public"."gym_users"
    ADD CONSTRAINT "gym_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gyms"
    ADD CONSTRAINT "gyms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membership_plans"
    ADD CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_gym_user_id_branch_id_key" UNIQUE ("gym_user_id", "branch_id");



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_accounts_owner" ON "public"."accounts" USING "btree" ("owner_id");



CREATE INDEX "idx_attendance_branch" ON "public"."attendance" USING "btree" ("branch_id");



CREATE INDEX "idx_attendance_branch_date" ON "public"."attendance" USING "btree" ("branch_id", "check_in_date");



CREATE INDEX "idx_attendance_gym_branch" ON "public"."attendance" USING "btree" ("gym_id", "branch_id");



CREATE INDEX "idx_attendance_gym_created_at" ON "public"."attendance" USING "btree" ("gym_id", "created_at" DESC);



CREATE INDEX "idx_attendance_gym_status" ON "public"."attendance" USING "btree" ("gym_id", "status");



CREATE INDEX "idx_attendance_member" ON "public"."attendance" USING "btree" ("member_id");



CREATE INDEX "idx_attendance_member_date" ON "public"."attendance" USING "btree" ("member_id", "check_in_date" DESC);



CREATE INDEX "idx_attendance_member_id" ON "public"."attendance" USING "btree" ("member_id");



CREATE INDEX "idx_branches_gym" ON "public"."branches" USING "btree" ("gym_id");



CREATE INDEX "idx_branches_gym_id" ON "public"."branches" USING "btree" ("gym_id");



CREATE INDEX "idx_expenses_branch" ON "public"."expenses" USING "btree" ("branch_id");



CREATE INDEX "idx_expenses_date" ON "public"."expenses" USING "btree" ("expense_date");



CREATE INDEX "idx_expenses_gym_branch" ON "public"."expenses" USING "btree" ("gym_id", "branch_id");



CREATE INDEX "idx_expenses_gym_created_at" ON "public"."expenses" USING "btree" ("gym_id", "created_at" DESC);



CREATE INDEX "idx_expenses_gym_expense_date" ON "public"."expenses" USING "btree" ("gym_id", "expense_date" DESC);



CREATE INDEX "idx_expenses_gym_id" ON "public"."expenses" USING "btree" ("gym_id");



CREATE INDEX "idx_expenses_gym_status" ON "public"."expenses" USING "btree" ("gym_id", "status");



CREATE INDEX "idx_gym_users_gym" ON "public"."gym_users" USING "btree" ("gym_id");



CREATE INDEX "idx_gym_users_gym_id" ON "public"."gym_users" USING "btree" ("gym_id");



CREATE INDEX "idx_gym_users_user_gym" ON "public"."gym_users" USING "btree" ("user_id", "gym_id");



CREATE INDEX "idx_gym_users_user_id" ON "public"."gym_users" USING "btree" ("user_id");



CREATE INDEX "idx_gyms_account" ON "public"."gyms" USING "btree" ("account_id");



CREATE INDEX "idx_gyms_account_id" ON "public"."gyms" USING "btree" ("account_id");



CREATE INDEX "idx_invitations_gym" ON "public"."invitations" USING "btree" ("gym_id");



CREATE INDEX "idx_invitations_gym_id" ON "public"."invitations" USING "btree" ("gym_id");



CREATE INDEX "idx_invitations_token_hash" ON "public"."invitations" USING "btree" ("token_hash");



CREATE INDEX "idx_members_branch" ON "public"."members" USING "btree" ("branch_id");



CREATE INDEX "idx_members_branch_created_at" ON "public"."members" USING "btree" ("branch_id", "created_at" DESC);



CREATE INDEX "idx_members_branch_id" ON "public"."members" USING "btree" ("branch_id");



CREATE INDEX "idx_members_branch_status" ON "public"."members" USING "btree" ("branch_id", "status");



CREATE INDEX "idx_members_gym_branch" ON "public"."members" USING "btree" ("gym_id", "branch_id");



CREATE INDEX "idx_members_gym_created_at" ON "public"."members" USING "btree" ("gym_id", "created_at" DESC);



CREATE INDEX "idx_members_gym_status" ON "public"."members" USING "btree" ("gym_id", "status");



CREATE INDEX "idx_members_phone" ON "public"."members" USING "btree" ("phone");



CREATE INDEX "idx_members_user" ON "public"."members" USING "btree" ("user_id");



CREATE INDEX "idx_members_user_id" ON "public"."members" USING "btree" ("user_id");



CREATE INDEX "idx_membership_plans_branch" ON "public"."membership_plans" USING "btree" ("branch_id");



CREATE INDEX "idx_memberships_end_date" ON "public"."memberships" USING "btree" ("end_date" DESC);



CREATE INDEX "idx_memberships_gym_branch" ON "public"."memberships" USING "btree" ("gym_id", "branch_id");



CREATE INDEX "idx_memberships_gym_created_at" ON "public"."memberships" USING "btree" ("gym_id", "created_at" DESC);



CREATE INDEX "idx_memberships_gym_status" ON "public"."memberships" USING "btree" ("gym_id", "status");



CREATE INDEX "idx_memberships_member" ON "public"."memberships" USING "btree" ("member_id");



CREATE INDEX "idx_memberships_member_id" ON "public"."memberships" USING "btree" ("member_id");



CREATE INDEX "idx_memberships_member_status" ON "public"."memberships" USING "btree" ("member_id", "status");



CREATE INDEX "idx_memberships_status" ON "public"."memberships" USING "btree" ("status");



CREATE INDEX "idx_memberships_status_end" ON "public"."memberships" USING "btree" ("status", "end_date");



CREATE INDEX "idx_notices_branch" ON "public"."notices" USING "btree" ("branch_id");



CREATE INDEX "idx_notices_gym" ON "public"."notices" USING "btree" ("gym_id");



CREATE INDEX "idx_notices_gym_id" ON "public"."notices" USING "btree" ("gym_id");



CREATE INDEX "idx_payments_branch" ON "public"."payments" USING "btree" ("branch_id");



CREATE INDEX "idx_payments_branch_created" ON "public"."payments" USING "btree" ("branch_id", "created_at" DESC);



CREATE INDEX "idx_payments_branch_id" ON "public"."payments" USING "btree" ("branch_id");



CREATE INDEX "idx_payments_date" ON "public"."payments" USING "btree" ("payment_date");



CREATE INDEX "idx_payments_gym_branch" ON "public"."payments" USING "btree" ("gym_id", "branch_id");



CREATE INDEX "idx_payments_gym_created_at" ON "public"."payments" USING "btree" ("gym_id", "created_at" DESC);



CREATE INDEX "idx_payments_gym_id" ON "public"."payments" USING "btree" ("gym_id");



CREATE INDEX "idx_payments_gym_payment_date" ON "public"."payments" USING "btree" ("gym_id", "payment_date" DESC);



CREATE INDEX "idx_payments_gym_payment_status" ON "public"."payments" USING "btree" ("gym_id", "payment_status");



CREATE INDEX "idx_payments_gym_status" ON "public"."payments" USING "btree" ("gym_id", "status");



CREATE INDEX "idx_payments_member" ON "public"."payments" USING "btree" ("member_id");



CREATE INDEX "idx_payments_member_id" ON "public"."payments" USING "btree" ("member_id");



CREATE INDEX "idx_plans_branch_id" ON "public"."membership_plans" USING "btree" ("branch_id");



CREATE INDEX "idx_uba_branch" ON "public"."user_branch_access" USING "btree" ("branch_id");



CREATE INDEX "idx_uba_gym_user" ON "public"."user_branch_access" USING "btree" ("gym_user_id");



CREATE OR REPLACE TRIGGER "trg_sync_attendance_gym_id" BEFORE INSERT OR UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."sync_gym_id_from_branch"();



CREATE OR REPLACE TRIGGER "trg_sync_members_gym_id" BEFORE INSERT OR UPDATE ON "public"."members" FOR EACH ROW EXECUTE FUNCTION "public"."sync_gym_id_from_branch"();



CREATE OR REPLACE TRIGGER "trg_sync_memberships_gym_id" BEFORE INSERT OR UPDATE ON "public"."memberships" FOR EACH ROW EXECUTE FUNCTION "public"."sync_memberships_gym_and_branch"();



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gym_users"
    ADD CONSTRAINT "gym_users_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gym_users"
    ADD CONSTRAINT "gym_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gyms"
    ADD CONSTRAINT "gyms_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."membership_plans"
    ADD CONSTRAINT "membership_plans_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_gym_user_id_fkey" FOREIGN KEY ("gym_user_id") REFERENCES "public"."gym_users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accounts_owner_all" ON "public"."accounts" TO "authenticated" USING (("owner_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("owner_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_delete" ON "public"."attendance" FOR DELETE TO "authenticated" USING ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "attendance_insert" ON "public"."attendance" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")) OR (("check_in_method" = 'member_portal'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."members" "m"
  WHERE (("m"."id" = "attendance"."member_id") AND ("m"."branch_id" = "attendance"."branch_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("m"."status" = 'active'::"text")))))));



CREATE POLICY "attendance_select" ON "public"."attendance" FOR SELECT TO "authenticated" USING (("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_member_owner"("member_id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "attendance_update" ON "public"."attendance" FOR UPDATE TO "authenticated" USING ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "branches_delete" ON "public"."branches" FOR DELETE TO "authenticated" USING ("public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "branches_insert" ON "public"."branches" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "branches_select" ON "public"."branches" FOR SELECT TO "authenticated" USING (("public"."is_gym_staff"("gym_id", ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."members" "m"
  WHERE (("m"."branch_id" = "branches"."id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "branches_update" ON "public"."branches" FOR UPDATE TO "authenticated" USING ("public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_staff_all" ON "public"."expenses" TO "authenticated" USING ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."gym_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gym_users_delete" ON "public"."gym_users" FOR DELETE TO "authenticated" USING ("public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gym_users_insert" ON "public"."gym_users" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gym_users_select" ON "public"."gym_users" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_gym_staff"("gym_id", ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "gym_users_update" ON "public"."gym_users" FOR UPDATE TO "authenticated" USING ("public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."gyms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gyms_select" ON "public"."gyms" FOR SELECT TO "authenticated" USING (("public"."is_gym_staff"("id", ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM ("public"."members" "m"
     JOIN "public"."branches" "b" ON (("b"."id" = "m"."branch_id")))
  WHERE (("b"."gym_id" = "gyms"."id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "gyms_update" ON "public"."gyms" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."gym_users" "gu"
  WHERE (("gu"."gym_id" = "gyms"."id") AND ("gu"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("gu"."role" = 'owner'::"text") AND ("gu"."status" = 'active'::"text")))));



ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitations_owner_all" ON "public"."invitations" TO "authenticated" USING ("public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_gym_owner"("gym_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members_delete" ON "public"."members" FOR DELETE TO "authenticated" USING ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "members_insert" ON "public"."members" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "members_select" ON "public"."members" FOR SELECT TO "authenticated" USING (("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "members_update" ON "public"."members" FOR UPDATE TO "authenticated" USING (("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."membership_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "memberships_delete" ON "public"."memberships" FOR DELETE TO "authenticated" USING ("public"."has_branch_access"("public"."get_member_branch_id"("member_id"), ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "memberships_insert" ON "public"."memberships" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_branch_access"("public"."get_member_branch_id"("member_id"), ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "memberships_select" ON "public"."memberships" FOR SELECT TO "authenticated" USING (("public"."has_branch_access"("public"."get_member_branch_id"("member_id"), ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_member_owner"("member_id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "memberships_update" ON "public"."memberships" FOR UPDATE TO "authenticated" USING ("public"."has_branch_access"("public"."get_member_branch_id"("member_id"), ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."has_branch_access"("public"."get_member_branch_id"("member_id"), ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."notices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notices_delete" ON "public"."notices" FOR DELETE TO "authenticated" USING ("public"."is_gym_staff"("gym_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "notices_insert" ON "public"."notices" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_gym_staff"("gym_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "notices_select" ON "public"."notices" FOR SELECT TO "authenticated" USING (("public"."is_gym_staff"("gym_id", ( SELECT "auth"."uid"() AS "uid")) OR (("is_active" = true) AND (EXISTS ( SELECT 1
   FROM ("public"."members" "m"
     JOIN "public"."branches" "b" ON (("b"."id" = "m"."branch_id")))
  WHERE (("b"."gym_id" = "notices"."gym_id") AND (("notices"."branch_id" IS NULL) OR ("notices"."branch_id" = "m"."branch_id")) AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "notices_update" ON "public"."notices" FOR UPDATE TO "authenticated" USING ("public"."is_gym_staff"("gym_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_gym_staff"("gym_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_delete" ON "public"."payments" FOR DELETE TO "authenticated" USING ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "payments_insert" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "payments_select" ON "public"."payments" FOR SELECT TO "authenticated" USING (("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_member_owner"("member_id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "payments_update" ON "public"."payments" FOR UPDATE TO "authenticated" USING ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "plans_delete" ON "public"."membership_plans" FOR DELETE TO "authenticated" USING ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "plans_insert" ON "public"."membership_plans" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "plans_select" ON "public"."membership_plans" FOR SELECT TO "authenticated" USING (("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."members" "m"
  WHERE (("m"."branch_id" = "membership_plans"."branch_id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "plans_update" ON "public"."membership_plans" FOR UPDATE TO "authenticated" USING ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."has_branch_access"("branch_id", ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."user_branch_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_branch_access_delete" ON "public"."user_branch_access" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."gym_users" "gu"
  WHERE (("gu"."id" = "user_branch_access"."gym_user_id") AND "public"."is_gym_owner"("gu"."gym_id", ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "user_branch_access_insert" ON "public"."user_branch_access" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."gym_users" "gu"
  WHERE (("gu"."id" = "user_branch_access"."gym_user_id") AND "public"."is_gym_owner"("gu"."gym_id", ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "user_branch_access_select" ON "public"."user_branch_access" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."gym_users" "gu"
  WHERE (("gu"."id" = "user_branch_access"."gym_user_id") AND (("gu"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_gym_owner"("gu"."gym_id", ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "user_branch_access_update" ON "public"."user_branch_access" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."gym_users" "gu"
  WHERE (("gu"."id" = "user_branch_access"."gym_user_id") AND "public"."is_gym_owner"("gu"."gym_id", ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."gym_users" "gu"
  WHERE (("gu"."id" = "user_branch_access"."gym_user_id") AND "public"."is_gym_owner"("gu"."gym_id", ( SELECT "auth"."uid"() AS "uid"))))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."accept_invitation"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_member_claim_v2"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_member_claim_v2"("p_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_member_claim_v2"("p_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_staff_invitation_v2"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_staff_invitation_v2"("p_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_staff_invitation_v2"("p_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_owner_account"("p_name" "text", "p_gym_name" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_owner_account"("p_name" "text", "p_gym_name" "text", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_owner_account"("p_name" "text", "p_gym_name" "text", "p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_owner_account_v2"("p_full_name" "text", "p_gym_name" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_owner_account_v2"("p_full_name" "text", "p_gym_name" "text", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_owner_account_v2"("p_full_name" "text", "p_gym_name" "text", "p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_member_branch_id"("p_member_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_member_branch_id"("p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_member_branch_id"("p_member_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_branch_access"("p_branch_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_branch_access"("p_branch_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_branch_access"("p_branch_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_gym_owner"("p_gym_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_gym_owner"("p_gym_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_gym_owner"("p_gym_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_gym_staff"("p_gym_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_gym_staff"("p_gym_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_gym_staff"("p_gym_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_member_owner"("p_member_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_member_owner"("p_member_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_owner"("p_member_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_gym_id_from_branch"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_gym_id_from_branch"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_memberships_gym_and_branch"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_memberships_gym_and_branch"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."verify_invitation_token"("p_token_hash" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."verify_invitation_token_v2"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_invitation_token_v2"("p_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_invitation_token_v2"("p_token_hash" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."verify_invitation_token_v2"("p_token_hash" "text") TO "anon";


















GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."gym_users" TO "anon";
GRANT ALL ON TABLE "public"."gym_users" TO "authenticated";
GRANT ALL ON TABLE "public"."gym_users" TO "service_role";



GRANT ALL ON TABLE "public"."gyms" TO "anon";
GRANT ALL ON TABLE "public"."gyms" TO "authenticated";
GRANT ALL ON TABLE "public"."gyms" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."membership_plans" TO "anon";
GRANT ALL ON TABLE "public"."membership_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."membership_plans" TO "service_role";



GRANT ALL ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



GRANT ALL ON TABLE "public"."notices" TO "anon";
GRANT ALL ON TABLE "public"."notices" TO "authenticated";
GRANT ALL ON TABLE "public"."notices" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_branch_access" TO "anon";
GRANT ALL ON TABLE "public"."user_branch_access" TO "authenticated";
GRANT ALL ON TABLE "public"."user_branch_access" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































