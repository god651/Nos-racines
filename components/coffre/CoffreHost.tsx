"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { isDue, isRecipient, openDateOf, publishMyKeys, releasedCode } from "@/lib/local/coffre";
import { getLink } from "@/lib/local/sync";
import { navigate } from "@/lib/local/router";
import { getDataVersion, kv, read, subscribeData } from "@/lib/local/store-core";
import { isNative } from "@/lib/native";
import { sound } from "@/lib/sound";
import type { Capsule, User } from "@/lib/types";
import { CoffreKey } from "./parts";

// La notification du jour J : « Un coffre s'ouvre pour vous aujourd'hui », avec la clé et son code.
// Sur Android, une vraie notification est aussi programmée à l'avance pour ce matin-là (9 h),
// même si l'application est fermée.

const seen = (id: string) => kv.get(`nr_coffre_vu_${id}`) === "1" || kv.get(`nr_coffre_notif_${id}`) === "1";

async function scheduleNative(me: User, list: Capsule[]) {
  if (!isNative) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const upcoming = list.filter((c) => isRecipient(c, me) && !isDue(c));
    const fresh = upcoming.filter((c) => kv.get(`nr_coffre_prog_${c.id}`) !== openDateOf(c));
    if (!fresh.length) return;
    const p = await LocalNotifications.checkPermissions();
    if (p.display !== "granted" && (await LocalNotifications.requestPermissions()).display !== "granted") return;
    await LocalNotifications.schedule({
      notifications: fresh.map((c) => {
        const [y, m, d] = openDateOf(c).split("-").map(Number);
        return {
          id: Math.abs([...c.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) % 2000000000,
          title: "Un coffre s’ouvre pour vous aujourd’hui",
          body: `${c.byName} vous a laissé un coffre${c.title ? ` : « ${c.title} »` : ""}. Votre clé vous attend dans Nos Racines.`,
          schedule: { at: new Date(y, m - 1, d, 9, 0, 0), allowWhileIdle: true },
          extra: { coffre: c.id },
        };
      }),
    });
    fresh.forEach((c) => kv.set(`nr_coffre_prog_${c.id}`, openDateOf(c)));
  } catch {}
}

let listening = false;
async function listenTaps() {
  if (!isNative || listening) return;
  listening = true;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    void LocalNotifications.addListener("localNotificationActionPerformed", (a) => {
      const id = (a.notification.extra as { coffre?: string } | undefined)?.coffre;
      if (id) navigate(`/capsule/${id}`);
    });
  } catch {}
}

export function CoffreHost({ me, blocked }: { me: User | null; blocked: boolean }) {
  const t = useT();
  const dataV = useSyncExternalStore(subscribeData, getDataVersion);
  const [show, setShow] = useState<{ c: Capsule; code: string | null } | null>(null);

  useEffect(() => {
    if (!me) return;
    void listenTaps();
    void scheduleNative(me, read().capsules);
    // Partage activé après coup : les clés de mes coffres sont confiées au gardien.
    if (getLink()) void publishMyKeys(me);
  }, [me, dataV]);

  useEffect(() => {
    if (!me || blocked || show) return;
    const due = read().capsules.find((c) => isRecipient(c, me) && isDue(c) && !seen(c.id));
    if (!due) return;
    void releasedCode(due).then((code) => {
      setShow({ c: due, code });
      sound.play("bell");
    });
  }, [me, blocked, dataV, show]);

  const close = (go: boolean) => {
    if (!show) return;
    kv.set(`nr_coffre_notif_${show.c.id}`, "1");
    if (go) navigate(`/capsule/${show.c.id}`);
    setShow(null);
  };

  if (blocked) return null;
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="coffre" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[73] flex items-center justify-center bg-[rgba(8,16,11,0.82)] px-5" role="dialog" aria-modal="true">
          <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 160, damping: 18 }} className="w-full max-w-[400px] rounded-[28px] border border-or/50 bg-[linear-gradient(160deg,#1F3D2B,#12261A)] p-6 text-center text-coton shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
            <p className="font-serif text-xs tracking-[5px] text-or">NOS RACINES</p>
            <h2 className="mt-3 font-serif text-[25px] font-light leading-tight">{t("Un coffre s’ouvre pour vous aujourd’hui")}</h2>
            <p className="mt-1 text-[14px] text-or-pale">{t("De la part de {nom}", { nom: show.c.byName })}{show.c.title ? ` · « ${show.c.title} »` : ""}</p>
            <motion.div className="mt-5 flex justify-center" animate={{ rotate: [-4, 4, -4], y: [0, -4, 0] }} transition={{ duration: 4, repeat: Infinity }}>
              <CoffreKey code={show.code ?? undefined} size={64} />
            </motion.div>
            <p className="mt-4 text-[13px] leading-relaxed text-coton/80">
              {show.code ? t("Voici sa clé. Le code gravé dessus : {code}.", { code: show.code }) : t("La clé arrivera dès que ce téléphone aura Internet.")}
            </p>
            <button onClick={() => close(true)} className="mt-5 min-h-12 w-full rounded-full bg-or text-[15px] font-semibold text-nuit">
              {t("Ouvrir le coffre")}
            </button>
            <button onClick={() => close(false)} className="mt-2 text-[13px] text-or-pale/80">
              {t("Plus tard")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
