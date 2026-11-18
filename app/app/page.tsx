import { resolvePostLoginRedirect } from "@/lib/auth/redirect";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const cookieStore = await cookies();
  const lastGymId = cookieStore.get("gymapra_last_gym_id")?.value;

  if (lastGymId) {
    redirect(`/app/${lastGymId}/dashboard`);
  }

  const destination = await resolvePostLoginRedirect();
  redirect(destination.path);
}
