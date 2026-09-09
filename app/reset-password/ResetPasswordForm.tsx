"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { changePasswordAction } from "@/app/actions/auth";

const input =
  "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

const fieldLabel = "block text-sm font-semibold text-foreground mb-2";

/* ── Password field w/ show-hide toggle ─────────────────────────────────── */

function PasswordField({
  id,
  name,
  label,
  placeholder,
}: {
  id:          string;
  name:        string;
  label:       string;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>{label}</label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          dir="rtl"
          required
          minLength={8}
          className={`${input} pl-11`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "إخفاء" : "إظهار"}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

type VerifyStatus = "verifying" | "ready" | "invalid";

export default function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("verifying");
  const [state, formAction, isUpdating] = useActionState(changePasswordAction, null);
  const showSuccess = !!(state && "success" in state);

  /*
   * Supabase's recovery link can land here in two shapes depending on the
   * auth flow configured for the project:
   *   - PKCE:     ?code=xxxxx                         (query param)
   *   - Implicit: #access_token=xxx&type=recovery&...  (hash fragment)
   *
   * The hash fragment is never sent to the server, so it can only be read
   * client-side. `createBrowserClient` auto-detects it on init and fires a
   * `PASSWORD_RECOVERY` auth event once the session is set — we just listen
   * for that. For the PKCE case we exchange the code ourselves. A short poll
   * covers the (rare) case where the auto-detect listener attaches slightly
   * after supabase-js has already consumed the hash.
   */
  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      setVerifyStatus(ok ? "ready" : "invalid");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        finish(true);
      }
    });

    (async () => {
      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        finish(!error);
        return;
      }

      for (let i = 0; i < 10 && !settled; i++) {
        await new Promise((r) => setTimeout(r, 300));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { finish(true); break; }
      }
      finish(false);
    })();

    return () => {
      settled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => {
      router.push("/login");
    }, 2000);
    return () => clearTimeout(t);
  }, [showSuccess, router]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-32">

      {/* ── Sticky header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 h-14 flex items-center justify-center">
        <Link href="/">
          <Image src="/logo.svg" alt="دولابي" width={120} height={48} className="object-contain w-auto h-8" />
        </Link>
      </header>

      {/* ── Card — strict 400px desktop width, centered ─────────────── */}
      <div className="px-4 pt-8 mx-auto md:mt-16" style={{ maxWidth: 400 }}>
        <div className="md:border md:border-border md:rounded-2xl md:p-8 md:shadow-sm md:bg-card">

          <div className="flex flex-col items-center mb-6">
            <Image src="/logo.svg" alt="دولابي" width={140} height={56} className="object-contain w-auto h-16 md:h-20 mb-3" />
            <h1 className="text-lg font-bold text-foreground">إعادة تعيين كلمة المرور</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              اختر كلمة مرور جديدة لحسابك في دولابي
            </p>
          </div>

          {/* ── Verifying the recovery link ─────────────────────────── */}
          {verifyStatus === "verifying" && (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">جاري التحقق من الرابط...</p>
            </div>
          )}

          {/* ── Invalid / expired link ───────────────────────────────── */}
          {verifyStatus === "invalid" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <XCircle className="h-9 w-9 text-red-500" />
              <p className="text-sm font-semibold text-foreground">
                الرابط غير صالح أو منتهي الصلاحية
              </p>
              <p className="text-sm text-muted-foreground">
                يرجى طلب رابط جديد لإعادة تعيين كلمة المرور من صفحة تسجيل الدخول.
              </p>
              <Link
                href="/login"
                className="text-sm font-semibold text-primary hover:underline underline-offset-4 mt-1"
              >
                العودة لتسجيل الدخول
              </Link>
            </div>
          )}

          {/* ── New password form ────────────────────────────────────── */}
          {verifyStatus === "ready" && (
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>

              <PasswordField
                id="password"
                name="password"
                label="كلمة المرور الجديدة"
                placeholder="8 أحرف على الأقل"
              />

              <PasswordField
                id="confirm"
                name="confirm"
                label="تأكيد كلمة المرور"
                placeholder="أعد كتابة كلمة المرور"
              />

              {state && "error" in state && (
                <p className="text-sm text-red-500 text-center">{state.error}</p>
              )}

              {showSuccess && (
                <div className="flex items-center gap-2 justify-center text-sm font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  تم تحديث كلمة المرور بنجاح! جاري تحويلك لتسجيل الدخول...
                </div>
              )}

              <button
                type="submit"
                disabled={isUpdating || showSuccess}
                className="
                  w-full py-4 rounded-2xl
                  bg-[#522742] text-white font-bold text-[15px]
                  hover:brightness-110 active:scale-[0.98]
                  transition-all disabled:opacity-60 disabled:cursor-not-allowed
                  shadow-[0_4px_24px_rgba(82,39,66,0.40)]
                "
              >
                {isUpdating ? "جاري الحفظ..." : "حفظ كلمة المرور"}
              </button>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
