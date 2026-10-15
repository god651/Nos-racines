// Le Griot de la famille, version « questions libres » (fonction Supabase Edge).
// Il reçoit la question, le résumé de la famille préparé par le téléphone, et répond
// avec un modèle de langue. Réservé aux membres actifs de la famille, avec une limite
// par personne et par jour. La clé du modèle reste ici, sur le serveur (secret ANTHROPIC_API_KEY).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const LANGS: Record<string, string> = { fr: "français", en: "English", bci: "français (la personne a choisi le baoulé : glisse quelques mots baoulé seulement si tu en es sûr)", dyu: "français (la personne a choisi le dioula : glisse quelques mots dioula seulement si tu en es sûr)" };

const SYSTEM = (familyName: string, lang: string) => `Tu es le Griot de la famille ${familyName}, dans l'application NOS RACINES (Côte d'Ivoire).
Tu parles comme un griot bienveillant : chaleureux, respectueux des anciens, clair et précis. Réponds en ${LANGS[lang] ?? "français"}.

Règles :
- Pour tout ce qui concerne CETTE famille (personnes, liens, dates, lieux, récits), tu t'appuies UNIQUEMENT sur les données fournies entre <famille> et </famille>. Tu n'inventes jamais un fait, une date, un lien ou un souvenir. Si l'information manque, dis-le simplement et suggère qui pourrait la compléter.
- Tu peux raisonner sur l'arbre : cousins, oncles, neveux, âges, générations, qui vient d'où, calculs de dates.
- Pour les questions plus larges (histoire et cultures de Côte d'Ivoire, peuples akan, baoulé, dioula, sénoufo, bété…, traditions, noms et leur sens, proverbes, fêtes, conseils pour recueillir la mémoire des anciens), tu peux utiliser tes connaissances générales, en le signalant (« De façon générale… ») et sans jamais les présenter comme l'histoire de cette famille.
- Ne prétends jamais reproduire la voix d'une personne. Ne parle pas à la place d'un défunt.
- Pas d'emoji. Réponses courtes (un à trois paragraphes), sauf si on te demande un récit.
- Quand tu parles d'une personne de la famille, écris son nom complet tel qu'il apparaît dans les données.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { fid, question, context, lang, familyName, history } = (await req.json()) as {
      fid: string; question: string; context: string; lang?: string; familyName?: string; history?: { me: boolean; text: string }[];
    };
    if (!fid || !question || question.length > 1000) return json({ error: "question" }, 400);
    // Membre actif de la famille, et pas plus de 40 questions libres par jour.
    const { data: left, error } = await sb.rpc("nr_griot_tick", { fid });
    if (error) return json({ error: /ACCES|CONNEXION/.test(error.message) ? "acces" : "serveur" }, 403);
    if ((left as number) < 0) return json({ error: "limite" }, 429);
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "non_configure" }, 503);

    const messages = [
      ...(history ?? []).slice(-6).map((m) => ({ role: m.me ? "user" : "assistant", content: String(m.text).slice(0, 2000) })),
      { role: "user", content: `<famille>\n${String(context ?? "").slice(0, 120000)}\n</famille>\n\nQuestion : ${question}` },
    ];
    // L'historique doit commencer par la personne.
    while (messages.length && messages[0].role !== "user") messages.shift();
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("GRIOT_MODEL") ?? "claude-haiku-5-5", max_tokens: 900, system: SYSTEM(familyName ?? "", lang ?? "fr"), messages }),
    });
    if (!r.ok) return json({ error: "modele", detail: (await r.text()).slice(0, 300) }, 502);
    const out = (await r.json()) as { content: { type: string; text?: string }[] };
    const answer = out.content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
    return json({ answer, left });
  } catch (e) {
    return json({ error: "serveur", detail: String(e).slice(0, 200) }, 500);
  }
});
