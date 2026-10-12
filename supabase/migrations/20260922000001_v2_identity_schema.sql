-- GymApra V2: Clean Identity, Multi-Tenancy, and RBAC Schema
-- Phase 1 Foundation

-- 1. Accounts (SaaS Account / Organization)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subscription_tier TEXT NOT NULL DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'pro', 'enterprise')),
    trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Gyms (Tenant Profile)
CREATE TABLE IF NOT EXISTS public.gyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Branches (Physical Facility Locations)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Main Branch',
    code TEXT,
    address TEXT,
    city TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Profiles (User Identity linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Gym Users (Staff Roles within a Gym)
CREATE TABLE IF NOT EXISTS public.gym_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'partner', 'manager', 'staff', 'trainer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(gym_id, user_id)
);

-- 6. User Branch Access (Explicit Branch Permissions for Staff)
CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_user_id UUID NOT NULL REFERENCES public.gym_users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(gym_user_id, branch_id)
);

-- 7. Members (Member Dossier - Phone First, Portal Linking via user_id)
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    avatar_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Invitations (Cryptographic Tokens for Staff & Member Self-Claim)
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('partner', 'manager', 'staff', 'trainer', 'member')),
    branch_ids UUID[] NOT NULL DEFAULT '{}',
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_gyms_account_id ON public.gyms(account_id);
CREATE INDEX IF NOT EXISTS idx_branches_gym_id ON public.branches(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_users_user_id ON public.gym_users(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_users_gym_id ON public.gym_users(gym_id);
CREATE INDEX IF NOT EXISTS idx_members_branch_id ON public.members(branch_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_gym_id ON public.invitations(gym_id);
