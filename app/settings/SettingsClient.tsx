"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Bell, ChevronLeft, FileText,
  Lock, Mail, MessageCircle, Trash2, AlertTriangle,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { deleteAccountAction } from "@/app/actions/auth";

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SectionHeading({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-1">
      {title}
    </p>
  );
}

function RowItem({
  icon: Icon,
  label,
  sub,
  href,
  external,
  onClick,
}: {
  icon:     LucideIcon;
  label:    string;
  sub?:     string;
  href?:    string;
  external?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
      <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
    </>
  );

  const cls = "flex items-center justify-between px-4 py-4 hover:bg-muted transition-colors w-full text-right";

  if (href && external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
  }
  if (href) {
    return <Link href={href} className={cls}>{inner}</Link>;
  }
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

/* ── Delete confirmation modal ───────────────────────────────────────────── */

function DeleteModal({
  onClose,
  formAction,
  pending,
  error,
}: {
  onClose:    () => void;
  formAction: (payload: FormData) => void;
  pending:    boolean;
  error:      string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        dir="rtl"
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">حذف الحساب نهائياً</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            سيتم حذف حسابك وجميع بياناتك بشكل دائم ولا يمكن التراجع عن هذا الإجراء.
            هل أنت متأكد من المتابعة؟
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 mt-1">
          <form action={formAction}>
            <button
              type="submit"
              disabled={pending}
              className="
                w-full py-3 rounded-xl
                bg-red-500 text-white font-bold text-sm
                hover:bg-red-600 active:scale-[0.98]
                transition-all disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              {pending ? "جاري الحذف..." : "نعم، احذف حسابي"}
            </button>
          </form>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="
              w-full py-3 rounded-xl
              border border-border bg-card
              text-sm font-semibold text-foreground
              hover:bg-muted active:scale-[0.98]
              transition-all disabled:opacity-60
            "
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function SettingsClient({ email }: { email: string }) {
  const router = useRouter();
  const [notifications,    setNotifications]    = useState(true);
  const [showDeleteModal,  setShowDeleteModal]  = useState(false);

  const [deleteState, deleteFormAction, deleting] = useActionState(
    deleteAccountAction,
    null,
  );

  const deleteError = deleteState && "error" in deleteState ? deleteState.error : null;

  return (
    <>
      <div dir="rtl" className="min-h-screen bg-background pb-32">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="w-full border-b border-gray-200 bg-gray-50 md:border-none md:bg-transparent md:mt-8 md:mb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="رجوع"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0 md:hidden"
            >
              <ArrowRight className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 py-4 md:py-0 md:text-3xl md:font-bold">
              الإعدادات
            </h1>
          </div>
        </div>

        {/* ── Card ───────────────────────────────────────────────────── */}
        <div className="px-4 pt-8 md:max-w-xl md:mx-auto md:mt-12 md:px-0">
          <div className="md:border md:border-border md:rounded-2xl md:overflow-hidden md:shadow-sm md:bg-card flex flex-col gap-6 md:gap-0">

            {/* ── Account ──────────────────────────────────────────── */}
            <div>
              <div className="px-4 pb-1">
                <SectionHeading title="الحساب" />
              </div>
              <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border md:rounded-none md:border-x-0 md:border-t md:border-b">
                <RowItem
                  icon={Mail}
                  label="البريد الإلكتروني"
                  sub={email}
                />
                <RowItem
                  icon={Lock}
                  label="تغيير كلمة المرور"
                  href="/settings/change-password"
                />
              </div>
            </div>

            {/* ── Preferences ──────────────────────────────────────── */}
            <div>
              <div className="px-4 pb-1">
                <SectionHeading title="التفضيلات" />
              </div>
              <div className="bg-card rounded-2xl border border-border overflow-hidden md:rounded-none md:border-x-0 md:border-t md:border-b">
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium text-foreground">الإشعارات</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={notifications}
                    onClick={() => setNotifications((n) => !n)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ${
                      notifications ? "bg-primary" : "bg-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        notifications ? "-translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Support ──────────────────────────────────────────── */}
            <div>
              <div className="px-4 pb-1">
                <SectionHeading title="الدعم" />
              </div>
              <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border md:rounded-none md:border-x-0 md:border-t md:border-b">
                <RowItem
                  icon={MessageCircle}
                  label="تواصل معنا"
                  href="https://wa.me/218924368922"
                  external
                />
                <RowItem
                  icon={FileText}
                  label="الشروط والأحكام"
                  href="/terms"
                />
              </div>
            </div>

            {/* ── Danger zone ──────────────────────────────────────── */}
            <div className="md:p-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="
                  w-full py-3.5 rounded-2xl
                  border border-red-200 bg-red-50
                  text-red-500 font-semibold text-sm
                  flex items-center justify-center gap-2
                  hover:bg-red-100 active:scale-[0.98]
                  transition-all
                "
              >
                <Trash2 className="h-4 w-4" />
                حذف الحساب
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── Delete modal (rendered outside the main flow) ────────────── */}
      {showDeleteModal && (
        <DeleteModal
          onClose={() => setShowDeleteModal(false)}
          formAction={deleteFormAction}
          pending={deleting}
          error={deleteError}
        />
      )}
    </>
  );
}
