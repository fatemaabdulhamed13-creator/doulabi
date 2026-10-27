import Image from "next/image";
import Link from "next/link";
import StoreLink from "./StoreLink";

// While a link is null its badge is shown dimmed with a "coming soon" note and isn't clickable.
const APP_STORE_URL: string | null = "https://apps.apple.com/app/id6810699386";
const PLAY_STORE_URL: string | null = "https://play.google.com/store/apps/details?id=com.doulabi.app&hl=ar";

function StoreBadge({ href, src, alt, width }: { href: string | null; src: string; alt: string; width: number }) {
  const badge = <Image src={src} alt={alt} width={width} height={48} unoptimized className="h-12 w-auto" />;
  return href ? (
    <StoreLink href={href}>{badge}</StoreLink>
  ) : (
    <span aria-disabled="true" className="flex flex-col items-center gap-1.5">
      <span className="opacity-50">{badge}</span>
      <span className="text-xs text-gray-500">قريباً</span>
    </span>
  );
}

export default function SellPage() {
  return (
    <div dir="rtl" className="min-h-[70vh] bg-background flex items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center text-center w-full max-w-md">
        <Image
          src="/sell-app-mockup.png"
          alt="تطبيق دولابي"
          width={1080}
          height={1920}
          priority
          sizes="(max-width: 768px) 60vw, 240px"
          className="w-auto h-auto max-w-full max-h-[400px] object-contain mb-10"
        />

        <h1 className="text-2xl md:text-3xl font-black text-foreground leading-snug mb-3">
          إضافة الإعلانات متاحة عبر التطبيق فقط
        </h1>
        <p className="text-[15px] text-gray-500 leading-loose mb-10">
          لبيع ملابسك، حمّل تطبيق دولابي وأضف إعلانك خلال دقائق.
          <br />
          يمكنك الاستمرار في تصفح المعروضات هنا على الموقع.
        </p>

        <div className="flex flex-col items-center gap-5">
          <span className="text-sm font-semibold text-foreground">حمّل التطبيق</span>
          <div className="flex flex-wrap items-start justify-center gap-4">
            <StoreBadge href={APP_STORE_URL} src="/app-store-badge-ar.svg" alt="حمّله من App Store" width={144} />
            <StoreBadge href={PLAY_STORE_URL} src="/google-play-badge-ar.svg" alt="احصل عليه من Google Play" width={162} />
          </div>
        </div>

        <Link
          href="/search"
          className="mt-12 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          تصفّح المعروضات ‹
        </Link>
      </div>
    </div>
  );
}
