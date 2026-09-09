"use client";

import { useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { forgotPasswordAction } from "@/app/actions/auth";

/* ── Shared field styles ─────────────────────────────────────────────────── */

const input =
  "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

const fieldLabel = "block text-sm font-semibold text-foreground mb-2";

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  const showSuccess = !!(state && "success" in state);

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
            <h1 className="text-lg font-bold text-foreground">نسيت كلمة المرور؟</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور
            </p>
          </div>

          {showSuccess ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              <p className="text-sm font-semibold text-foreground">
                تم إرسال الرابط بنجاح
              </p>
              <p className="text-sm text-muted-foreground">
                إذا كان بريدك الإلكتروني مسجلاً لدينا، ستصلك رسالة تحتوي على رابط
                إعادة تعيين كلمة المرور خلال دقائق.
              </p>
              <Link
                href="/login"
                className="text-sm font-semibold text-primary hover:underline underline-offset-4 mt-1"
              >
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form action={action} className="flex flex-col gap-5">

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

              {/* Error */}
              {state && "error" in state && (
                <p className="text-sm text-red-500 text-center -mt-1">
                  {state.error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                className="
                  w-full py-4 rounded-2xl mt-1
                  bg-primary text-white font-bold text-[15px]
                  hover:brightness-110 active:scale-[0.98]
                  transition-all disabled:opacity-60 disabled:cursor-not-allowed
                  shadow-[0_4px_24px_rgba(93,42,66,0.40)]
                "
              >
                {pending ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
              </button>

              {/* Footer link */}
              <p className="text-center text-sm text-muted-foreground pt-1">
                تذكرت كلمة المرور؟{" "}
                <Link
                  href="/login"
                  className="font-semibold text-primary hover:underline underline-offset-4"
                >
                  تسجيل الدخول
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
