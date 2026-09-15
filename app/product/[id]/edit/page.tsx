import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditListingForm from "./EditListingForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/product/${id}/edit`);

  const { data: product } = await supabase
    .from("products")
    .select("id, seller_id, title, price, category, brand, condition, description, city, is_open_to_offers, delivery_available, status, size_type, size_value")
    .eq("id", id)
    .single();

  if (!product) notFound();
  if (product.seller_id !== user.id) redirect(`/product/${id}`);
  // Drafts and pending items can also be edited
  if (product.status === "rejected") redirect(`/product/${id}`);

  return <EditListingForm product={product} />;
}
