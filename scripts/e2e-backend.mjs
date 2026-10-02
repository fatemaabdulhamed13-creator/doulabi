#!/usr/bin/env node
// End-to-end backend check: creates two throwaway accounts (seller + buyer), runs
// everything the app does against the LIVE project (listings, photo upload, WhatsApp
// privacy, search, favorites, reports, blocking, sold, push tokens, deletes), prints
// PASS/FAIL per step, then deletes the accounts and everything they created.
// Run before each release:  node --env-file=.env.local scripts/e2e-backend.mjs

import { createClient } from "@supabase/supabase-js";
const { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SR } = process.env;
const admin = createClient(URL, SR, { auth: { persistSession: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const results = []; const created = { users: [], products: [] };
const ok = (name, cond, extra = "") => { results.push([cond ? "PASS" : "FAIL", name, extra]); };
const stamp = Date.now();
async function makeUser(tag, phone) {
  const email = `e2e-${tag}-${stamp}@example.com`, password = "E2eTestPass123";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.users.push(data.user.id);
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email, password });
  ok(`${tag}: login with password`, !s.error, s.error?.message);
  const p = await c.from("profiles").insert({ id: data.user.id, full_name: `E2E ${tag}`, whatsapp_number: phone });
  ok(`${tag}: create own profile`, !p.error, p.error?.message);
  return { id: data.user.id, c, token: s.data.session?.access_token };
}
try {
  const A = await makeUser("seller", "+218911111111");
  const B = await makeUser("buyer", "+218922222222");

  // ── Listing lifecycle ──────────────────────────────────────────────────
  const ins = await A.c.from("products").insert({
    seller_id: A.id, title: `فستان أحمر تجربة ${stamp}`, description: "اختبار", price: 150, category: "فساتين",
    brand: "زارا", size_value: "M", size_type: "letters", color: "أحمر", condition: "كالجديد",
    city: "طرابلس", delivery_available: false, is_open_to_offers: true, image_urls: [], status: "approved",
  }).select("id,status").single();
  ok("seller: create listing", !ins.error, ins.error?.message);
  const pid = ins.data?.id; created.products.push(pid);
  ok("new listing is forced to pending (no self-approval)", ins.data?.status === "pending", ins.data?.status);
  let v = await anon.from("products").select("id").eq("id", pid);
  ok("pending listing hidden from public", v.data?.length === 0);
  await admin.from("products").update({ status: "approved" }).eq("id", pid);   // = admin approval
  v = await anon.from("products").select("id").eq("id", pid);
  ok("approved listing visible to public", v.data?.length === 1);

  // ── Photos: presign → upload → attach ──────────────────────────────────
  const pres = await fetch(`${URL}/functions/v1/presign-upload`, { method: "POST",
    headers: { Authorization: `Bearer ${A.token}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "x.webp", contentType: "image/webp", thumb: "1" }) }).then(r => r.json());
  ok("presign-upload returns photo + thumb URLs", !!pres.presignedUrl && !!pres.thumbPresignedUrl, pres.error);
  const bytes = new Uint8Array([82,73,70,70,26,0,0,0,87,69,66,80,86,80,56,76,13,0,0,0,47,0,0,0,16,7,16,17,17,136,136,254,7,0]);
  const put = await fetch(pres.presignedUrl, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: bytes });
  const putT = await fetch(pres.thumbPresignedUrl, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: bytes });
  ok("upload photo + thumbnail (bytes, signed type)", put.status === 200 && putT.status === 200, `${put.status}/${putT.status}`);
  const wrong = await fetch(pres.presignedUrl, { method: "PUT", headers: { "Content-Type": "text/html" }, body: bytes });
  ok("upload with a different type is rejected (security)", wrong.status === 403, String(wrong.status));
  const photoUrl = `https://img.shopdoulabi.com/${pres.key}`;
  const att = await A.c.from("products").update({ image_urls: [photoUrl] }).eq("id", pid).select("status").single();
  ok("seller: attach photo to listing", !att.error, att.error?.message);
  ok("changing photos sends approved listing back to review", att.data?.status === "pending", att.data?.status);
  await admin.from("products").update({ status: "approved" }).eq("id", pid);

  // ── WhatsApp privacy ───────────────────────────────────────────────────
  let w = await B.c.from("profiles").select("whatsapp_number").eq("id", A.id);
  ok("buyer can NOT read numbers directly", !!w.error, w.error?.code);
  w = await B.c.rpc("get_seller_whatsapp", { p_product_id: pid });
  ok("buyer gets seller number via function", w.data === "+218911111111", JSON.stringify(w.data ?? w.error?.message));
  w = await anon.rpc("get_seller_whatsapp", { p_product_id: pid });
  ok("logged-out visitor can NOT get number", !!w.error);
  w = await B.c.rpc("get_my_whatsapp");
  ok("user reads own number (profile edit)", w.data === "+218922222222", JSON.stringify(w.data));
  const pe = await B.c.from("profiles").update({ city: "بنغازي" }).eq("id", B.id).select("id").single();
  ok("profile edit save works", !pe.error, pe.error?.message);

  // ── Search (Arabic-normalized) ─────────────────────────────────────────
  const s1 = await anon.from("products").select("id").eq("id", pid).ilike("search_text", "%احمر%").ilike("search_text", "%زارا%");
  ok("search: 'احمر' finds 'أحمر', brand searchable", s1.data?.length === 1, s1.error?.message);

  // ── Favorites, most liked ──────────────────────────────────────────────
  const f = await B.c.from("favorites").insert({ user_id: B.id, product_id: pid });
  ok("buyer: favorite", !f.error, f.error?.message);
  const ml = await anon.rpc("get_most_liked_products", { min_likes: 1, max_results: 50 });
  ok("most liked works for visitors", !ml.error && Array.isArray(ml.data), ml.error?.message);
  const fs = await B.c.from("favorites").select("product_id, products ( id, is_sold )").eq("user_id", B.id);
  ok("favorites list loads with sold flag", fs.data?.[0]?.products?.is_sold === false, fs.error?.message);

  // ── Report with reason ─────────────────────────────────────────────────
  const rep = await B.c.from("reports").insert({ reporter_id: B.id, product_id: pid, reason: "fake" });
  ok("report with reason", !rep.error, rep.error?.message);
  const rep2 = await B.c.from("reports").insert({ reporter_id: B.id, product_id: pid, reason: "fake" });
  ok("duplicate report → 'already reported'", rep2.error?.code === "23505", rep2.error?.code);
  const rr = await B.c.from("reports").select("*");
  ok("users can't read reports", (rr.data ?? []).length === 0);

  // ── Blocking ───────────────────────────────────────────────────────────
  const bl = await B.c.from("blocks").insert({ blocker_id: B.id, blocked_id: A.id });
  ok("buyer: block seller", !bl.error, bl.error?.message);
  v = await B.c.from("products").select("id").eq("id", pid);
  ok("blocked seller's listing hidden from buyer", v.data?.length === 0);
  w = await B.c.rpc("get_seller_whatsapp", { p_product_id: pid });
  ok("no WhatsApp number across a block", w.data === null, JSON.stringify(w.data));
  const vA = await A.c.from("products").select("id").eq("id", pid);
  ok("seller still sees own listing", vA.data?.length === 1);
  const ub = await B.c.from("blocks").delete().eq("blocker_id", B.id).eq("blocked_id", A.id);
  v = await B.c.from("products").select("id").eq("id", pid);
  ok("unblock → listing visible again", !ub.error && v.data?.length === 1, ub.error?.message);

  // ── Sold ───────────────────────────────────────────────────────────────
  const so = await A.c.from("products").update({ is_sold: true }).eq("id", pid).select("is_sold, sold_at, status").single();
  ok("seller: mark sold (sold_at set, stays approved)", so.data?.is_sold && !!so.data?.sold_at && so.data?.status === "approved", JSON.stringify(so.data ?? so.error?.message));
  v = await anon.from("products").select("id").eq("id", pid).eq("is_sold", false);
  ok("sold listing leaves public lists", v.data?.length === 0);
  w = await B.c.rpc("get_seller_whatsapp", { p_product_id: pid });
  ok("no WhatsApp for sold listing", w.data === null);

  // ── Misc ───────────────────────────────────────────────────────────────
  const tok = `ExponentPushToken[e2e-${stamp}]`;
  const dt = await A.c.rpc("register_device_token", { p_token: tok, p_platform: "ios" });
  ok("push token registration", !dt.error, dt.error?.message);
  const dt2 = await B.c.rpc("register_device_token", { p_token: tok, p_platform: "ios" });
  const own = await admin.from("device_tokens").select("user_id").eq("push_token", tok).single();
  ok("same phone, different account takes over token", !dt2.error && own.data?.user_id === B.id, dt2.error?.message);
  const off = await B.c.from("device_tokens").update({ is_active: false }).eq("push_token", tok).select("is_active");
  ok("sign-out deactivates own token", !off.error && off.data?.[0]?.is_active === false, off.error?.message);
  const nt = await A.c.from("notifications").select("id").limit(1);
  ok("notifications inbox query", !nt.error, nt.error?.message);
  const ac = await anon.from("app_config").select("minimum_version").eq("platform", "ios").maybeSingle();
  ok("force-update config readable", !ac.error, ac.error?.message);
  const col = await anon.from("collection_products").select("sort_order, products!inner(id), collections!inner(slug)").eq("collections.slug", "home-carousel").limit(1);
  ok("home carousel query", !col.error && col.data?.length > 0, col.error?.message);

  // ── Deleting: listing (with photos) and accounts, via the real functions ──
  const dp = await fetch(`${URL}/functions/v1/delete-product`, { method: "POST",
    headers: { Authorization: `Bearer ${A.token}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ productId: pid, id: pid }) });
  const dpBody = await dp.text();
  const gone = await admin.from("products").select("id").eq("id", pid);
  ok("delete-product function removes listing", dp.ok && gone.data?.length === 0, `${dp.status} ${dpBody.slice(0,120)}`);
  if (gone.data?.length === 0) created.products = [];
  await new Promise(r => setTimeout(r, 4000));
  const origin = await fetch(`${photoUrl}?nocache=${stamp}`);
  ok("its photo is deleted from storage", origin.status === 404, String(origin.status));
  for (const U of [B, A]) {
    const da = await fetch(`${URL}/functions/v1/delete-account`, { method: "POST",
      headers: { Authorization: `Bearer ${U.token}`, apikey: ANON, "Content-Type": "application/json" }, body: "{}" });
    const still = await admin.auth.admin.getUserById(U.id);
    const removed = !!still.error || !still.data?.user;
    ok(`delete-account function (${U === A ? "seller" : "buyer"})`, da.ok && removed, `${da.status} ${(await da.text()).slice(0,100)}`);
    if (removed) created.users = created.users.filter(id => id !== U.id);
  }
} catch (e) {
  ok("script crashed", false, e.message);
} finally {
  for (const id of created.products) await admin.from("products").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  for (const [s, n, x] of results) console.log(`${s}  ${n}${s === "FAIL" && x ? "  → " + x : ""}`);
  console.log(`\n${results.filter(r => r[0] === "PASS").length}/${results.length} passed; leftover test data cleaned: users ${created.users.length === 0 ? "✓" : "✗"}`);
}
