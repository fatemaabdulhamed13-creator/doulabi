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

  // Your own number comes from get_my_whatsapp() — the column isn't
  // directly readable (20261001 migrations).
  const [{ data: profile }, { data: ownWhatsapp }] = await Promise.all([
    supabase.from("profiles").select("full_name, city, bio").eq("id", user.id).single(),
    supabase.rpc("get_my_whatsapp"),
  ]);

  return (
    <EditProfileForm
      initialName={profile?.full_name       ?? ""}
      initialWhatsapp={typeof ownWhatsapp === "string" ? ownWhatsapp : ""}
      initialCity={profile?.city            ?? ""}
      initialBio={profile?.bio              ?? ""}
    />
  );
}
