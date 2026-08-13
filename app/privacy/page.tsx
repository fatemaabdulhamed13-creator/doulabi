import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* ── Static section data ─────────────────────────────────────────────────── */
// NOTE: unlike terms/page.tsx (the site's original, business-approved
// legal text), there was no standalone Privacy Policy anywhere in the
// project before this — only a short data-protection paragraph inside the
// Terms (§7). This content was drafted for the mobile app's in-app privacy
// screen, staying strictly within what's already publicly committed to
// there (no data selling, deletion on request, 18+ minimum age) plus
// factual disclosure of the actual infrastructure this app uses (Supabase,
// Cloudflare R2). Ported here verbatim so both platforms link to the same
// policy. This is drafted, not legally reviewed — treat it as a starting
// point for App Store / Play Store submission, not a final policy.
const SECTIONS = [
  {
    title: "١. المعلومات التي نجمعها",
    body: `عند التسجيل واستخدام دولابي، نجمع: الاسم الكامل، البريد الإلكتروني، رقم واتساب، المدينة (اختياري)، ونبذة عنك (اختياري). عند نشر إعلان، نجمع تفاصيل المنتج وصوره التي تقومين بتحميلها. لا نجمع أي معلومات دفع — جميع المعاملات المالية تتم مباشرةً بين البائع والمشتري خارج التطبيق.`,
  },
  {
    title: "٢. كيف نستخدم معلوماتك",
    body: `نستخدم معلوماتك لتشغيل المنصة: عرض إعلاناتك، تمكين المشترين من التواصل معك عبر واتساب، عرض ملفك الشخصي للبائعين والمشترين الآخرين، وتحسين تجربة استخدام التطبيق. رقم الواتساب الخاص بك يظهر للمشترين المهتمين بمنتجاتك فقط عند تفعيل التواصل.`,
  },
  {
    title: "٣. أين تُخزَّن بياناتك",
    body: `تُخزَّن بياناتك النصية (الحساب، الإعلانات، المفضلة) عبر Supabase، وتُخزَّن صور المنتجات عبر Cloudflare R2. كلا المزودين يستخدمان تشفيراً قياسياً في الصناعة لحماية البيانات أثناء النقل والتخزين.`,
  },
  {
    title: "٤. مشاركة البيانات",
    body: `لا نبيع بياناتك الشخصية لأي طرف ثالث. لا تتم مشاركة بياناتك إلا في الحدود اللازمة لتشغيل الخدمة (مثل مزودي الاستضافة المذكورين أعلاه) أو عند الالتزام بمتطلبات قانونية.`,
  },
  {
    title: "٥. حقوقك",
    body: `يحق لك في أي وقت طلب الاطلاع على بياناتك، تصحيحها، أو حذفها نهائياً. يمكنك حذف حسابك وجميع بياناتك المرتبطة به مباشرةً من داخل التطبيق عبر: الإعدادات ← منطقة الخطر ← حذف الحساب، أو بالتواصل معنا عبر واتساب.`,
  },
  {
    title: "٦. الأطفال",
    body: `دولابي غير موجّه للأطفال دون سن 18 عاماً، ولا نجمع بيانات عن قصد من أي شخص دون هذا السن.`,
  },
  {
    title: "٧. تواصل معنا",
    body: `لأي استفسار يتعلق بخصوصيتك أو بياناتك، تواصلي مع فريق دولابي عبر واتساب على الرقم: 218924368922+`,
  },
];

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function PrivacyPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background pb-20">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="w-full border-b border-gray-200 bg-gray-50 md:border-none md:bg-transparent md:mt-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center gap-3">
          <Link
            href="/settings"
            aria-label="رجوع"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0 md:hidden"
          >
            <ArrowRight className="h-5 w-5 text-foreground" />
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 py-4 md:py-0 md:text-3xl md:font-bold">
            سياسة الخصوصية
          </h1>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 md:pt-12">

        {/* Intro banner */}
        <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 mb-10">
          <p className="text-sm text-foreground leading-relaxed">
            توضح هذه السياسة كيفية جمع{" "}
            <span className="font-bold text-primary">دولابي</span> لبياناتك
            واستخدامها وحمايتها عند استخدامك للمنصة والتطبيق.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            آخر تحديث: مايو 2026
          </p>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-base font-bold text-foreground mb-2.5">
                {s.title}
              </h2>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {s.body}
              </div>
              <div className="mt-6 border-b border-gray-100" />
            </section>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center mt-10">
          © 2026 دولابي — جميع الحقوق محفوظة
        </p>
      </article>
    </div>
  );
}
