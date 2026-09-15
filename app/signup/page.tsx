"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signUpAction } from "@/app/actions/auth";

/* ── Shared field styles ─────────────────────────────────────────────────── */

const input =
  "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

const fieldLabel = "block text-sm font-semibold text-foreground mb-2";

// Libyan mobile numbers: 9 digits, always starting with 9 (91/92/94/95…).
// Instant format check — no more "test the wa.me link and confirm it
// opened" round trip, which depended on WhatsApp being installed and the
// browser reliably reporting tab focus (broke in in-app browsers / PWA
// contexts and blocked signup entirely when it did).
const WHATSAPP_PATTERN = /^9\d{8}$/;

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUpAction, null);

  const [whatsapp, setWhatsapp] = useState("");

  function handleWhatsappChange(e: React.ChangeEvent<HTMLInputElement>) {
    setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 9));
  }

  const whatsappTouched = whatsapp.length > 0;
  const whatsappValid   = WHATSAPP_PATTERN.test(whatsapp);
  const submitLocked    = pending || !whatsappValid;

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-32">

      {/* ── Sticky header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 h-14 flex items-center justify-center">
        <Link href="/">
          <Image src="/logo.svg" alt="دولابي" width={120} height={48} className="object-contain w-auto h-8" />
        </Link>
      </header>

      {/* ── Card ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-8 md:max-w-md md:mx-auto md:mt-16 md:px-0">
        <div className="md:border md:border-border md:rounded-2xl md:p-8 md:shadow-sm md:bg-card">

          {/* Logo + subtitle */}
          <div className="flex flex-col items-center mb-6">
            <Image src="/logo.svg" alt="دولابي" width={140} height={56} className="object-contain w-auto h-16 md:h-20 mb-3" />
            <p className="text-sm text-muted-foreground">انضم إلى دولابي مجاناً وابدأ البيع والشراء</p>
          </div>

          <form action={action} className="flex flex-col gap-5">

            {/* Full name */}
            <div>
              <label htmlFor="full_name" className={fieldLabel}>الاسم الكامل</label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="مثال: سارة محمد"
                dir="rtl"
                required
                className={input}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className={fieldLabel}>البريد الإلكتروني</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="example@email.com"
                dir="ltr"
                required
                className={`${input} placeholder:text-right`}
              />
            </div>

            {/* WhatsApp — prefix badge + number input, validated instantly */}
            <div>
              <label htmlFor="whatsapp_number" className={fieldLabel}>رقم الواتساب</label>

              {/* Phone input row */}
              <div
                dir="ltr"
                className={`flex rounded-xl border overflow-hidden bg-card transition-colors ${
                  whatsappTouched && !whatsappValid
                    ? "border-red-400 focus-within:border-red-500"
                    : "border-border focus-within:border-primary"
                }`}
              >
                <span className="shrink-0 flex items-center px-4 bg-muted border-r border-border text-sm font-semibold text-muted-foreground select-none">
                  +218
                </span>
                <input
                  id="whatsapp_number"
                  name="whatsapp_number"
                  type="tel"
                  inputMode="numeric"
                  placeholder="91XXXXXXX"
                  dir="ltr"
                  required
                  maxLength={9}
                  value={whatsapp}
                  onChange={handleWhatsappChange}
                  aria-invalid={whatsappTouched && !whatsappValid}
                  className="flex-1 px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none bg-transparent"
                />
              </div>

              {whatsappTouched && !whatsappValid ? (
                <p className="mt-1.5 text-xs text-red-500">
                  أدخل رقم واتساب ليبي صحيح (9 أرقام تبدأ بـ 9)
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  يُستخدم لتواصل المشترين معك — تأكد من صحته
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className={fieldLabel}>كلمة المرور</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                dir="ltr"
                required
                minLength={6}
                className={input}
              />
            </div>

            {/* Error */}
            {state?.error && (
              <p className="text-sm text-red-500 text-center -mt-1">
                {state.error}
              </p>
            )}

            {/* Submit — locked until the WhatsApp number looks valid */}
            <button
              type="submit"
              disabled={submitLocked}
              title={!whatsappValid ? "أدخل رقم واتساب صحيح أولاً" : undefined}
              className="
                w-full py-4 rounded-2xl mt-1
                bg-primary text-white font-bold text-[15px]
                hover:brightness-110 active:scale-[0.98]
                transition-all disabled:opacity-60 disabled:cursor-not-allowed
                shadow-[0_4px_24px_rgba(93,42,66,0.40)]
              "
            >
              {pending ? '…' : 'تسجيل'}
            </button>

            {/* Footer link */}
            <p className="text-center text-sm text-muted-foreground pt-1">
              لديك حساب بالفعل؟{" "}
              <Link
                href="/login"
                className="font-semibold text-primary hover:underline underline-offset-4"
              >
                تسجيل الدخول
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
