"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/core";

const ITEMS = [
  { href: "/accueil", label: tx("Accueil"), icon: <path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z" /> },
  {
    href: "/arbre",
    label: tx("Arbre"),
    icon: (
      <>
        <circle cx="12" cy="5" r="2.5" />
        <circle cx="5" cy="19" r="2.5" />
        <circle cx="19" cy="19" r="2.5" />
        <path d="M12 7.5V12M12 12L5 16.5M12 12l7 4.5" />
      </>
    ),
  },
  { href: "/ancien", label: tx("Raconter"), icon: null },
  { href: "/griot", label: tx("Griot"), icon: <path d="M4 5h16v11H8l-4 4zM8 9h8M8 12h5" /> },
  {
    href: "/moi",
    label: tx("Moi"),
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </>
    ),
  },
];

export function BottomNav() {
  const path = usePathname();
  const t = useT();
  return (
    <nav data-main-nav aria-label={t("Navigation principale")} className="sticky bottom-0 z-20 grid h-[84px] grid-cols-5 items-center border-t border-kapok bg-coton/90 px-3 pb-5 pt-2 backdrop-blur-xl">
      {ITEMS.map((it) =>
        it.icon === null ? (
          <Link key={it.href} href={it.href} aria-label={t(it.label)} className="flex justify-center">
            <span className="relative -mt-7 flex h-[58px] w-[58px] items-center justify-center rounded-full bg-or shadow-[0_0_0_6px_#FAF7F1,0_8px_20px_rgba(200,161,90,0.45)]">
              <span className="nr-ripple absolute inset-0 rounded-full border-2 border-or" />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#12261A" strokeWidth="1.8" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
            </span>
          </Link>
        ) : (
          <Link
            key={it.href}
            href={it.href}
            aria-current={path.startsWith(it.href) ? "page" : undefined}
            className={`flex flex-col items-center gap-[3px] text-[10px] ${path.startsWith(it.href) ? "font-semibold text-foret" : "text-[#5A5A52]"}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              {it.icon}
            </svg>
            {t(it.label)}
          </Link>
        ),
      )}
    </nav>
  );
}
