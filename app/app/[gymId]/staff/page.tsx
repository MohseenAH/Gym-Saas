import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { hasCapability } from "@/lib/auth/capabilities";
import { StaffClientView, StaffMember, StaffInvitation } from "./client";

interface PageProps {
  params: Promise<{ gymId: string }>;
}

export default async function StaffPage({ params }: PageProps) {
  const { gymId } = await params;
  const authContext = await getAuthorizedActionContext({ gymId });

  const supabase = await createClient();

  // Parallel fetch: staff members and invitations
  const [staffRes, invitationsRes] = await Promise.all([
    supabase
      .from("gym_users")
      .select("id, user_id, role, status, profiles(full_name, phone)")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, role, email, phone, status, expires_at, created_at")
      .eq("gym_id", gymId)
      .eq("type", "staff")
      .order("created_at", { ascending: false }),
  ]);

  const gym = authContext.gym;
  const staffMembers = staffRes.data || [];
  const invitations = invitationsRes.data || [];
  const branches = authContext.branches;

  const canManageStaff = hasCapability(authContext.role, "staff:manage");

  interface DbStaffMember {
    id: string;
    user_id: string;
    role: StaffMember["role"];
    status: StaffMember["status"];
    profiles?: { full_name?: string; phone?: string } | null;
  }

  const formattedStaff: StaffMember[] = ((staffMembers as unknown as DbStaffMember[]) || []).map((s) => ({
    id: s.id,
    userId: s.user_id,
    role: s.role,
    status: s.status,
    profiles: {
      full_name: s.profiles?.full_name || "Staff Member",
      phone: s.profiles?.phone || undefined,
    },
  }));

  interface DbInvitation {
    id: string;
    role: StaffInvitation["role"];
    email: string;
    phone?: string | null;
    status: StaffInvitation["status"];
    expires_at: string;
    created_at: string;
  }

  const formattedInvites: StaffInvitation[] = ((invitations as unknown as DbInvitation[]) || []).map((inv) => ({
    id: inv.id,
    role: inv.role,
    email: inv.email,
    phone: inv.phone,
    status: inv.status,
    expiresAt: inv.expires_at,
    createdAt: inv.created_at,
  }));

  return (
    <StaffClientView
      gymId={gymId}
      gymName={gym?.name || "Our Gym"}
      staffList={formattedStaff}
      invitations={formattedInvites}
      branches={branches || []}
      canManageStaff={canManageStaff}
    />
  );
}
