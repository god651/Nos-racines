"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

// Éléments d'interface communs : en-têtes, champs, interrupteurs, états vides.

export function BackButton({ href, dark = false }: { href?: string; dark?: boolean }) {
  const router = useRouter();
  const t = useT();
  const cls = `flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${dark ? "border-or-pale/25 bg-coton/10 backdrop-blur-md" : "border-or-pale bg-coton"}`;
  const icon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#E6D3A3" : "#1F3D2B"} strokeWidth="1.8" aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
  return href ? (
    <Link href={href} aria-label={t("Retour")} className={cls}>{icon}</Link>
  ) : (
    <button type="button" onClick={() => router.back()} aria-label={t("Retour")} className={cls}>{icon}</button>
  );
}

export function PageHeader({ title, kicker, back, right, dark = false }: { title: string; kicker?: string; back?: string; right?: React.ReactNode; dark?: boolean }) {
  return (
    <header className={`relative flex items-center gap-3 px-5 pb-4 pt-[52px] ${dark ? "text-coton" : "text-nuit"}`}>
      <BackButton href={back} dark={dark} />
      <div className="min-w-0 flex-1">
        {kicker && <p className={`font-main text-lg leading-none ${dark ? "text-or" : "text-or-fonce"}`}>{kicker}</p>}
        <h1 className="truncate font-serif text-[26px] font-light">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Card({ title, children, hint, className = "" }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }} className={`rounded-[20px] border border-or-pale/70 bg-white/70 p-4 shadow-doux ${className}`}>
      {title && <h2 className="mb-1 font-serif text-lg text-nuit">{title}</h2>}
      {hint && <p className="mb-3 text-[13px] leading-snug text-[#6B6455]">{hint}</p>}
      {children}
    </motion.section>
  );
}

const inputCls = "w-full rounded-[14px] border border-or-pale bg-coton px-3.5 py-3 text-[15px] text-ebene outline-none transition-colors placeholder:text-[#9A917F] focus:border-or focus:bg-white";

export function Field({ label, hint, ...rest }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-foret">{label}</span>
      <input {...rest} className={inputCls} />
      {hint && <span className="mt-1 block text-xs text-[#6B6455]">{hint}</span>}
    </label>
  );
}

export function Area({ label, hint, ...rest }: { label: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-foret">{label}</span>
      <textarea {...rest} className={`${inputCls} min-h-[110px] resize-y leading-relaxed`} />
      {hint && <span className="mt-1 block text-xs text-[#6B6455]">{hint}</span>}
    </label>
  );
}

export function Select({ label, children, ...rest }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-foret">{label}</span>
      <select
        {...rest}
        className={`${inputCls} appearance-none bg-no-repeat pr-10`}
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238A6A2E' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>")`,
          backgroundSize: "14px",
          backgroundPosition: "right 14px center",
        }}
      >
        {children}
      </select>
    </label>
  );
}

export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center justify-between gap-4 py-1.5 ${disabled ? "opacity-50" : ""}`}>
      <span>
        <span className="block text-[15px] text-ebene">{label}</span>
        {hint && <span className="block text-xs leading-snug text-[#6B6455]">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-foret" : "bg-[#D8CDB8]"}`}
      >
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className={`absolute top-1 h-5 w-5 rounded-full bg-coton shadow ${checked ? "right-1" : "left-1"}`} />
      </button>
    </label>
  );
}

export function PrimaryButton({ children, loading, className = "", ...rest }: { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} disabled={rest.disabled || loading} className={`flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-or px-6 text-[15px] font-semibold text-nuit shadow-or disabled:opacity-60 ${className}`}>
      {loading && <motion.span className="h-4 w-4 rounded-full border-2 border-nuit/30 border-t-nuit" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />}
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`flex min-h-12 items-center justify-center gap-2 rounded-full border border-or px-5 text-sm text-or-fonce disabled:opacity-50 ${className}`}>
      {children}
    </button>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  const t = useT();
  if (!message) return null;
  return (
    <motion.p role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-[14px] border border-terre/30 bg-terre/10 px-3.5 py-2.5 text-sm text-[#8A3A26]">
      {t(message)}
    </motion.p>
  );
}

export function EmptyState({ title, text, action, dark = false }: { title: string; text?: string; action?: React.ReactNode; dark?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col items-center rounded-[22px] border border-dashed px-6 py-8 text-center ${dark ? "border-or/40 text-coton" : "border-or bg-or/5 text-nuit"}`}>
      <svg width="54" height="58" viewBox="0 0 48 52" aria-hidden className="mb-3 opacity-80">
        <path d="M24 52V20" stroke="#8A6A2E" strokeWidth="2" />
        <path d="M24 30C10 28 6 16 8 8c10 2 16 10 16 22zM24 24c14-2 18-14 16-22-10 2-16 10-16 22z" fill="#C8A15A" opacity="0.8" />
      </svg>
      <p className="font-serif text-xl">{title}</p>
      {text && <p className={`mt-1.5 max-w-[280px] text-sm leading-relaxed ${dark ? "text-or-pale" : "text-[#6B6455]"}`}>{text}</p>}
      {action && <div className="mt-4 w-full max-w-[260px]">{action}</div>}
    </motion.div>
  );
}

export function RoleBadge({ admin, role }: { admin: boolean; role?: string | null }) {
  const t = useT();
  const editor = !admin && role === "editeur";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${admin ? "bg-or text-nuit" : editor ? "bg-foret text-coton" : "bg-kapok text-foret"}`}>
      {admin ? t("Administrateur") : editor ? t("Éditeur") : t("Lecteur")}
    </span>
  );
}
