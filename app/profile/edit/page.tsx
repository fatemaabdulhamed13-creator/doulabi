import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditProfileForm from "./EditProfileForm";

/* ── Server component — fetches real data, guards auth ───────────────────── */

export default async function EditProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, whatsapp_number, city, bio")
    .eq("id", user.id)
    .single();

  return (
    <EditProfileForm
      initialName={profile?.full_name       ?? ""}
      initialWhatsapp={profile?.whatsapp_number ?? ""}
      initialCity={profile?.city            ?? ""}
      initialBio={profile?.bio              ?? ""}
    />
  );
}
