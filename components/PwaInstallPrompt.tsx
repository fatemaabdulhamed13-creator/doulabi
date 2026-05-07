"use client";

/**
 * PwaInstallPrompt
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows a bottom-of-screen install banner on mobile only.
 *
 * Android / Chrome
 *   • Listens for `beforeinstallprompt`, stores the deferred event, and shows
 *     a toast with an "Install" button that calls prompt() on tap.
 *
 * iOS / Safari
 *   • `beforeinstallprompt` is never fired on iOS.  We detect the UA and show
 *     manual instructions (Share → Add to Home Screen) instead.
 *
 * Shared rules
 *   • Never shown if the app is already running in standalone (installed) mode.
 *   • Never shown on desktop (md+ breakpoint via CSS `hidden md:hidden`).
 *   • Dismissed state is persisted in localStorage so it won't reappear for
 *     PWA_DISMISS_DAYS days after the user taps "Not now" or ×.
 */

import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | null;

// ── Constants ──────────────────────────────────────────────────────────────

const LS_KEY          = "pwa_install_dismissed_until";
const PWA_DISMISS_DAYS = 14; // days before re-showing after dismissal
const SHOW_DELAY_MS   = 3500; // brief pause before banner slides in

// ── Helpers ────────────────────────────────────────────────────────────────

function isDismissed(): boolean {
  try {
    const until = localStorage.getItem(LS_KEY);
    if (!until) return false;
    return Date.now() < Number(until);
  } catch {
    return false;
  }
}

function saveDismissal() {
  try {
    const until = Date.now() + PWA_DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(LS_KEY, String(until));
  } catch {
    // localStorage unavailable — ignore
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari sets this when running from home screen
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // Android + Chrome (not already showing native prompt)
  if (/android/i.test(ua)) return "android";
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PwaInstallPrompt() {
  const [platform, setPlatform]             = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible]               = useState(false);

  useEffect(() => {
    // 1. Already installed or user dismissed recently → bail out early
    if (isStandalone() || isDismissed()) return;

    const plat = detectPlatform();
    if (!plat) return; // desktop or unsupported → do nothing

    setPlatform(plat);

    if (plat === "android") {
      // Android: wait for the browser to give us the deferred prompt
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }

    if (plat === "ios") {
      // iOS: no event — show manual instructions after the delay
      const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAndroidInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setVisible(false);
      // No need to save dismissal — user accepted
    }
  }

  function handleDismiss() {
    setVisible(false);
    saveDismissal();
  }

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!visible || !platform) return null;

  // ── Shared UI shell ────────────────────────────────────────────────────────

  return (
    /*
     * md:hidden  → completely removed from desktop layout; Tailwind purges
     *              any layout reflow risk on large screens.
     * bottom-20  → sits above the fixed BottomNav on mobile (h-16 + safe area).
     */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تثبيت تطبيق دولابي"
      dir="rtl"
      className="
        md:hidden
        fixed bottom-20 inset-x-3 z-[60]
        bg-white rounded-2xl shadow-2xl border border-gray-100
        flex flex-col gap-0
        overflow-hidden
        animate-in slide-in-from-bottom-6 duration-400 ease-out
      "
    >
      {/* ── Top accent bar ─────────────────────────────────────── */}
      <div className="h-1 w-full bg-gradient-to-l from-[#5D2A42] to-[#9b3f6a]" />

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-3.5 px-4 pt-4 pb-3">
        {/* App icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/apple-touch-icon.png"
          alt="أيقونة دولابي"
          className="w-12 h-12 rounded-2xl shrink-0 shadow-sm border border-gray-100"
        />

        {/* Text */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-[15px] font-bold text-gray-900 leading-tight">
            أضف دولابي للشاشة الرئيسية
          </p>
          <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
            {platform === "ios"
              ? <>
                  اضغط على{" "}
                  <span className="inline-flex items-center gap-0.5 font-semibold text-gray-700">
                    {/* iOS Share icon — inline SVG so no external dependency */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3.5 h-3.5 text-[#5D2A42]"
                      aria-hidden="true"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    {" "}مشاركة
                  </span>
                  {" "}ثم اختر{" "}
                  <span className="font-semibold text-gray-700">"إضافة إلى الشاشة الرئيسية"</span>
                </>
              : "وصول أسرع وتجربة أفضل بدون متصفح"
            }
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          aria-label="إغلاق"
          className="
            -mt-0.5 -ml-1 w-7 h-7 shrink-0
            flex items-center justify-center
            rounded-full text-gray-400
            hover:bg-gray-100 hover:text-gray-600
            transition-colors text-[18px] leading-none
          "
        >
          ×
        </button>
      </div>

      {/* ── Action buttons ─────────────────────────────────────── */}
      <div className="flex gap-2 px-4 pb-4">
        {platform === "android" && (
          <button
            onClick={handleAndroidInstall}
            className="
              flex-1 py-2.5 rounded-xl
              bg-[#5D2A42] text-white text-sm font-bold
              hover:brightness-110 active:scale-[0.97]
              transition-all
            "
          >
            تثبيت التطبيق
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="
            flex-1 py-2.5 rounded-xl
            border border-gray-200 bg-gray-50
            text-sm font-semibold text-gray-600
            hover:bg-gray-100 active:scale-[0.97]
            transition-all
          "
        >
          {platform === "ios" ? "حسناً، شكراً" : "ليس الآن"}
        </button>
      </div>
    </div>
  );
}
