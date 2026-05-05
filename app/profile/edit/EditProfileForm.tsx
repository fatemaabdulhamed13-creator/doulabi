"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, CheckCircle2 } from "lucide-react";
import { updateProfileAction } from "@/app/actions/profile";

/* ── Data ────────────────────────────────────────────────────────────────── */

const CITIES = [
  "طرابلس", "بنغازي", "مصراتة", "الزاوية", "البيضاء",
  "سبها", "زليتن", "أجدابيا", "سرت", "درنة", "غريان", "أخرى",
];

/* ── Shared styles ───────────────────────────────────────────────────────── */

const input =
  "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

const fieldLabel = "block text-sm font-semibold text-foreground mb-2";

/* ── Props ───────────────────────────────────────────────────────────────── */

interface Props {
  initialName: string;
  initialCity: string;
  initialBio:  string;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function EditProfileForm({ initialName, initialCity, initialBio }: Props) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState(updateProfileAction, null);

  const [name, setName] = useState(initialName);
  const [city, setCity] = useState(initialCity);
  const [bio,  setBio]  = useState(initialBio);

  // Auto-dismiss success toast after 3 s and navigate back
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (state && "success" in state) {
      setShowSuccess(true);
      const t = setTimeout(() => {
        setShowSuccess(false);
        router.push("/profile");
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  // Derive avatar initial from name
  const initial = name.trim()[0] ?? "؟";

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-32">

      {/* ── Header ───────────────────────────────────────────────────── */}
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
            تعديل الملف الشخصي
          </h1>
        </div>
      </div>

      {/* ── Card ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-8 md:max-w-xl md:mx-auto md:mt-12 md:px-0">
        <div className="md:border md:border-border md:rounded-2xl md:p-8 md:shadow-sm md:bg-card">

          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>

            {/* ── Avatar ─────────────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-3 pb-2">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-primary/10 ring-4 ring-primary/20 flex items-center justify-center">
                  <span className="text-4xl font-bold text-primary">{initial}</span>
                </div>
                {/* Camera overlay — kept as UI affordance; avatar upload not in scope */}
                <button
                  type="button"
                  aria-label="تغيير الصورة"
                  className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md hover:brightness-110 transition-all"
                >
                  <Camera className="h-4 w-4 text-white" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">اضغط لتغيير الصورة</p>
            </div>

            {/* ── Full name ──────────────────────────────────────────── */}
            <div>
              <label htmlFor="name" className={fieldLabel}>الاسم الكامل</label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسمك الكامل"
                dir="rtl"
                required
                className={input}
              />
            </div>

            {/* ── City ───────────────────────────────────────────────── */}
            <div>
              <label htmlFor="city" className={fieldLabel}>المدينة</label>
              <div className="relative">
                <select
                  id="city"
                  name="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  dir="rtl"
                  className={`${input} appearance-none cursor-pointer`}
                >
                  <option value="">اختر مدينتك</option>
                  {CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {/* Custom chevron */}
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>

            {/* ── Bio ────────────────────────────────────────────────── */}
            <div>
              <label htmlFor="bio" className={fieldLabel}>نبذة عني</label>
              <textarea
                id="bio"
                name="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="أخبر المشترين عن نفسك…"
                dir="rtl"
                rows={4}
                maxLength={200}
                className={`${input} resize-none leading-relaxed`}
              />
              <p className="text-xs text-muted-foreground mt-1.5 text-left">
                {bio.length} / 200
              </p>
            </div>

            {/* ── Error ──────────────────────────────────────────────── */}
            {state && "error" in state && (
              <p className="text-sm text-red-500 text-center">{state.error}</p>
            )}

            {/* ── Success toast ───────────────────────────────────────── */}
            {showSuccess && (
              <div className="flex items-center gap-2 justify-center text-sm font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                تم حفظ التعديلات بنجاح!
              </div>
            )}

            {/* ── Submit ─────────────────────────────────────────────── */}
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
              {pending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
