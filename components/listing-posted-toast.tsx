"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export default function ListingPostedToast() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("listing_posted") !== "1") return;

    setVisible(true);
    router.replace("/profile", { scroll: false });

    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, [searchParams, router]);

  if (!visible) return null;

  return (
    <div className="
      fixed top-6 left-1/2 -translate-x-1/2
      md:top-auto md:bottom-10 md:left-10 md:translate-x-0
      bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl
      flex items-center gap-3 z-50 transition-all duration-300
    ">
      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
      <div>
        <p className="text-sm font-semibold leading-tight">تم إرسال إعلانك بنجاح!</p>
        <p className="text-xs text-white/60 leading-tight mt-0.5">إعلانك قيد المراجعة وسيظهر قريباً.</p>
      </div>
    </div>
  );
}
