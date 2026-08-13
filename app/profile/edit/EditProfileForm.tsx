"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
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
  initialName:      string;
  initialWhatsapp:  string;
  initialCity:      string;
  initialBio:       string;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function EditProfileForm({
  initialName,
  initialWhatsapp,
  initialCity,
  initialBio,
}: Props) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState(updateProfileAction, null);

  const [name,      setName]     = useState(initialName);
  const [whatsapp,  setWhatsapp] = useState(initialWhatsapp);
  const [city,      setCity]     = useState(initialCity);
  const [bio,       setBio]      = useState(initialBio);
  const [showSuccess, setShowSuccess] = useState(false);

  // ── WhatsApp self-test gate ────────────────────────────────────────────
  // If the field already has a saved number we trust it was tested before;
  // start confirmed so the user isn't forced to re-test on every save.
  // The gate resets to 'untested' the moment they type a different number.
  type GateStatus = "untested" | "awaiting" | "confirming" | "confirmed";
  const initialGate: GateStatus = initialWhatsapp ? "confirmed" : "untested";
  const [gateStatus, setGateStatus] = useState<GateStatus>(initialGate);
  const testedNumber = useRef<string>(initialWhatsapp);
  const isWaitingForReturn = useRef(false);

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

  // visibilitychange → fire confirming step when user returns from WhatsApp
  useEffect(() => {
    function onVisibility() {
      if (!isWaitingForReturn.current) return;
      if (document.visibilityState === "visible") {
        isWaitingForReturn.current = false;
        setGateStatus("confirming");
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  }

  // ── Gate helpers ───────────────────────────────────────────────────────
  function handleWhatsappChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setWhatsapp(val);
    if (val !== testedNumber.current) {
      setGateStatus("untested");
      isWaitingForReturn.current = false;
    }
  }

  function handleTestLink() {
    if (!whatsapp) return;
    testedNumber.current = whatsapp;
    isWaitingForReturn.current = true;
    setGateStatus("awaiting");
    window.open(`https://wa.me/${whatsapp.replace(/\D/g, "")}`, "_blank");
  }

  function handleGateConfirmYes() { setGateStatus("confirmed"); }
  function handleGateConfirmNo()  { setGateStatus("untested"); testedNumber.current = ""; }

  const submitLocked = pending || gateStatus !== "confirmed";

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

            {/* ── Avatar initial ─────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-2 pb-2">
              <div className="w-24 h-24 rounded-full bg-primary/10 ring-4 ring-primary/20 flex items-center justify-center">
                <span className="text-4xl font-bold text-primary">{initial}</span>
              </div>
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

            {/* ── WhatsApp number ────────────────────────────────────── */}
            <div>
              <label htmlFor="whatsapp" className={fieldLabel}>رقم واتساب</label>
              <input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                inputMode="tel"
                value={whatsapp}
                onChange={handleWhatsappChange}
                placeholder="مثال: 218912345678"
                dir="ltr"
                className={`${input} text-left placeholder:text-right`}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                يُستخدم لتواصل المشترين معك — أدخل الرقم مع رمز البلد (218...)
              </p>

              {/* ── Gate UI — untested ────────────────────────────── */}
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
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-primary shrink-0" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    اختبار الرابط
                  </button>
                  <p className="text-xs text-muted-foreground text-center">
                    يجب التحقق من الرقم قبل الحفظ
                  </p>
                </div>
              )}

              {/* ── Gate UI — awaiting return ──────────────────────── */}
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

              {/* ── Gate UI — confirming ───────────────────────────── */}
              {gateStatus === "confirming" && (
                <div className="mt-2.5 rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-foreground text-center">
                    هل ظهرت محادثة واتساب بهذا الرقم بنجاح؟
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleGateConfirmYes}
                      className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      نعم، ظهرت ✓
                    </button>
                    <button
                      type="button"
                      onClick={handleGateConfirmNo}
                      className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      لا
                    </button>
                  </div>
                </div>
              )}

              {/* ── Gate UI — confirmed ────────────────────────────── */}
              {gateStatus === "confirmed" && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-emerald-600 shrink-0" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  تم التأكد من الرقم
                </p>
              )}
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
                <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
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

            {/* ── Success toast ──────────────────────────────────────── */}
            {showSuccess && (
              <div className="flex items-center gap-2 justify-center text-sm font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                تم حفظ التعديلات بنجاح!
              </div>
            )}

            {/* ── Submit ─────────────────────────────────────────────── */}
            <button
              type="submit"
              disabled={submitLocked}
              title={gateStatus !== "confirmed" ? "يجب التحقق من رقم الواتساب أولاً" : undefined}
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
