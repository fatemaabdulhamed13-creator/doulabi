"use client";

import { useState } from "react";

// In-app browsers (TikTok, Instagram, Facebook, Snapchat…) block the
// hand-off from a store link (apps.apple.com) to the store app, so iOS shows "action can't be
// completed". For those visitors we explain how to open the page in Safari
// instead of letting the tap fail. Android in-app browsers hand Play Store
// links off fine, so the help is iOS-only.
const IN_APP_BROWSER = /musical_ly|BytedanceWebview|TikTok|Instagram|FBAN|FBAV|FB_IAB|Snapchat|\bLine\//i;
const IOS = /iPhone|iPad|iPod/i;

export default function StoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (IOS.test(navigator.userAgent) && IN_APP_BROWSER.test(navigator.userAgent)) {
      e.preventDefault();
      setCopied(false);
      setShowHelp(true);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(href);
    } catch {
      // Some in-app browsers don't expose the async clipboard API.
      const input = document.createElement("textarea");
      input.value = href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
  }

  return (
    <>
      <a href={href} onClick={handleClick} className="hover:opacity-85 active:scale-[0.98] transition-all">
        {children}
      </a>

      {showHelp && (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black text-foreground mb-3">افتح الصفحة في Safari للتحميل</h2>
            <p className="text-[15px] text-gray-500 leading-loose mb-5">
              هذا المتصفح لا يسمح بفتح App Store.
              <br />
              اضغط على <span className="font-bold text-foreground">⋯</span> في الأعلى، ثم اختر
              <span className="font-bold text-foreground"> «فتح في المتصفح»</span>.
            </p>
            <button
              type="button"
              onClick={copyLink}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
            >
              {copied ? "تم نسخ الرابط ✓ الصقه في Safari" : "نسخ رابط التحميل"}
            </button>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-3 w-full py-2 text-sm font-semibold text-gray-500"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
}
