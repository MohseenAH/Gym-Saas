-- GymApra V2: Operational Schema (Memberships, Payments, Expenses, Attendance, Notices)
-- Phase 2 Foundation

-- 1. Membership Plans
CREATE TABLE IF NOT EXISTS public.membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Member Memberships (Subscriptions / Contracts)
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'frozen', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 3. Payments (Revenue Ledger)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other')),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'pending', 'refunded')),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Expenses (Cost Outflow / P&L Tracking)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'rent',
        'electricity',
        'salaries',
        'equipment',
        'maintenance',
        'marketing',
        'miscellaneous',
        'other'
    )),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'upi', 'card', 'cheque', 'other')),
    description TEXT,
    receipt_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Attendance (Daily Check-in Ledger)
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    check_in_method TEXT NOT NULL DEFAULT 'staff_manual' CHECK (check_in_method IN ('staff_manual', 'member_portal', 'kiosk_qr', 'biometric')),
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(member_id, check_in_date)
);

-- 6. Notices (Gym & Branch Announcements)
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE, -- NULL means gym-wide
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for high-frequency operations
CREATE INDEX IF NOT EXISTS idx_plans_branch_id ON public.membership_plans(branch_id);
CREATE INDEX IF NOT EXISTS idx_memberships_member_id ON public.memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);
CREATE INDEX IF NOT EXISTS idx_payments_gym_id ON public.payments(gym_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON public.payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON public.payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_gym_id ON public.expenses(gym_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON public.expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_date ON public.attendance(branch_id, check_in_date);
CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON public.attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_notices_gym_id ON public.notices(gym_id);
CREATE INDEX IF NOT EXISTS idx_notices_active ON public.notices(is_active);

-- Enable RLS on all operational tables
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Membership Plans: Staff have full access to their branch plans; Members can view
CREATE POLICY "plans_staff_all" ON public.membership_plans
  FOR ALL USING (public.has_branch_access(branch_id));

CREATE POLICY "plans_members_select" ON public.membership_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.branch_id = public.membership_plans.branch_id
        AND m.user_id = auth.uid()
    )
  );

-- Memberships: Staff manage; Members can view own memberships
CREATE POLICY "memberships_staff_all" ON public.memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = public.memberships.member_id
        AND public.has_branch_access(m.branch_id)
    )
  );

CREATE POLICY "memberships_member_select" ON public.memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = public.memberships.member_id
        AND m.user_id = auth.uid()
    )
  );

-- Payments: Staff manage; Members view own payments
CREATE POLICY "payments_staff_all" ON public.payments
  FOR ALL USING (public.has_branch_access(branch_id));

CREATE POLICY "payments_member_select" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = public.payments.member_id
        AND m.user_id = auth.uid()
    )
  );

-- Expenses: Only gym staff with branch access can view/record expenses
-- Note: Members have ZERO access to expenses
CREATE POLICY "expenses_staff_all" ON public.expenses
  FOR ALL USING (public.has_branch_access(branch_id));

-- Attendance: Staff manage branch attendance; Members can view own attendance and self-checkin
CREATE POLICY "attendance_staff_all" ON public.attendance
  FOR ALL USING (public.has_branch_access(branch_id));

CREATE POLICY "attendance_member_select" ON public.attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = public.attendance.member_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "attendance_member_insert_own" ON public.attendance
  FOR INSERT WITH CHECK (
    check_in_method = 'member_portal' AND
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = public.attendance.member_id
        AND m.branch_id = public.attendance.branch_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- Notices: Staff manage notices; Members view notices for their gym/branch
CREATE POLICY "notices_staff_all" ON public.notices
  FOR ALL USING (public.is_gym_staff(gym_id));

CREATE POLICY "notices_member_select" ON public.notices
  FOR SELECT USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM public.members m
      JOIN public.branches b ON m.branch_id = b.id
      WHERE b.gym_id = public.notices.gym_id
        AND (public.notices.branch_id IS NULL OR public.notices.branch_id = m.branch_id)
        AND m.user_id = auth.uid()
    )
  );
