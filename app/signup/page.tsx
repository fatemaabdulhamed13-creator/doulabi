"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signUpAction } from "@/app/actions/auth";

/* ── Shared field styles ─────────────────────────────────────────────────── */

const input =
  "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

const fieldLabel = "block text-sm font-semibold text-foreground mb-2";

/* ── WhatsApp gate state machine ─────────────────────────────────────────── */
// untested  → user hasn't clicked Test yet for the current number
// awaiting  → tab was opened, waiting for user to return
// confirming → user returned, showing inline Yes/No
// confirmed  → user confirmed the link worked — submit is unlocked

type GateStatus = "untested" | "awaiting" | "confirming" | "confirmed";

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUpAction, null);

  // Local state for the WhatsApp field (needed for gate logic)
  const [whatsapp, setWhatsapp]   = useState("");
  const [gateStatus, setGateStatus] = useState<GateStatus>("untested");

  // Keep a ref to the number that was last tested so we can reset if it changes
  const testedNumber = useRef<string>("");
  const isWaitingForReturn = useRef(false);

  // ── Tab-focus listener ───────────────────────────────────────────────────
  useEffect(() => {
    function handleVisibilityChange() {
      if (!isWaitingForReturn.current) return;
      if (document.visibilityState === "visible") {
        isWaitingForReturn.current = false;
        setGateStatus("confirming");
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ── Gate handlers ────────────────────────────────────────────────────────
  function handleWhatsappChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    setWhatsapp(digits);
    // If the user edits the number after a successful test, reset the gate
    if (digits !== testedNumber.current) {
      setGateStatus("untested");
      isWaitingForReturn.current = false;
    }
  }

  function handleTestLink() {
    if (!whatsapp) return;
    testedNumber.current = whatsapp;
    isWaitingForReturn.current = true;
    setGateStatus("awaiting");
    window.open(`https://wa.me/218${whatsapp}`, "_blank");
  }

  function handleConfirmYes() {
    setGateStatus("confirmed");
  }

  function handleConfirmNo() {
    setGateStatus("untested");
    testedNumber.current = "";
  }

  const submitLocked = pending || gateStatus !== "confirmed";

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

            {/* WhatsApp — prefix badge + number input + test gate */}
            <div>
              <label htmlFor="whatsapp_number" className={fieldLabel}>رقم الواتساب</label>

              {/* Phone input row */}
              <div
                dir="ltr"
                className="flex rounded-xl border border-border overflow-hidden bg-card focus-within:border-primary transition-colors"
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
                  className="flex-1 px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none bg-transparent"
                />
              </div>

              {/* ── Gate UI — untested ──────────────────────────────── */}
              {gateStatus === "untested" && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={handleTestLink}
                    disabled={!whatsapp}
                    className="
                      w-full flex items-center justify-center gap-2
                      py-3 rounded-xl border-2 border-primary
                      text-sm font-bold text-primary
                      hover:bg-primary/5 active:scale-[0.98]
                      transition-all disabled:opacity-40 disabled:cursor-not-allowed
                    "
                  >
                    {/* WhatsApp icon inline SVG */}
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-primary shrink-0" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    اختبار الرابط
                  </button>
                  <p className="text-xs text-muted-foreground text-center">
                    يجب اختبار الرابط قبل التسجيل للتأكد من صحة رقمك
                  </p>
                </div>
              )}

              {/* ── Gate UI — awaiting return ───────────────────────── */}
              {gateStatus === "awaiting" && (
                <div className="mt-2.5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-muted">
                  <svg className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    افتح واتساب وتحقق من الرقم، ثم عد إلى هذه الصفحة…
                  </p>
                </div>
              )}

              {/* ── Gate UI — confirming ────────────────────────────── */}
              {gateStatus === "confirming" && (
                <div className="mt-2.5 rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-foreground text-center">
                    هل ظهرت محادثة واتساب بهذا الرقم بنجاح؟
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmYes}
                      className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      نعم، ظهرت ✓
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmNo}
                      className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      لا
                    </button>
                  </div>
                </div>
              )}

              {/* ── Gate UI — confirmed ─────────────────────────────── */}
              {gateStatus === "confirmed" && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-emerald-600 shrink-0" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  تم التأكد من الرقم
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

            {/* Submit — locked until WhatsApp test passes */}
            <button
              type="submit"
              disabled={submitLocked}
              title={gateStatus !== "confirmed" ? "يجب اختبار رقم الواتساب أولاً" : undefined}
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
