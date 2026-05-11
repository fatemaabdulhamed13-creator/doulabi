"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { changePasswordAction } from "@/app/actions/auth";

const input =
  "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

const fieldLabel = "block text-sm font-semibold text-foreground mb-2";

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

export default function ChangePasswordPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(changePasswordAction, null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (state && "success" in state) {
      setShowSuccess(true);
      const t = setTimeout(() => {
        setShowSuccess(false);
        router.push("/settings");
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-32">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="w-full border-b border-gray-200 bg-gray-50 md:border-none md:bg-transparent md:mt-8 md:mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="رجوع"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0 md:hidden"
          >
            <ArrowRight className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 py-4 md:py-0 md:text-3xl md:font-bold">
            تغيير كلمة المرور
          </h1>
        </div>
      </div>

      {/* ── Card ───────────────────────────────────────────────────── */}
      <div className="px-4 pt-8 md:max-w-xl md:mx-auto md:mt-12 md:px-0">
        <div className="md:border md:border-border md:rounded-2xl md:p-8 md:shadow-sm md:bg-card">
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
                تم تغيير كلمة المرور بنجاح!
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="
                w-full py-4 rounded-2xl
                bg-primary text-white font-bold text-[15px]
                hover:brightness-110 active:scale-[0.98]
                transition-all disabled:opacity-60 disabled:cursor-not-allowed
                shadow-[0_4px_24px_rgba(93,42,66,0.40)]
              "
            >
              {pending ? "جاري الحفظ..." : "حفظ كلمة المرور"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
