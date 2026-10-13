// Remplace next/server : les « requêtes » sont des appels directs dans le téléphone.
import { kv } from "@/lib/local/store-core";
import { rememberSession } from "@/lib/local/accounts";

type CookieInit = { name: string; value: string } & Record<string, unknown>;

export class NextResponse {
  status: number;
  data: unknown;
  cookies = {
    set: (c: CookieInit | string, value?: string) => {
      const name = typeof c === "string" ? c : c.name;
      const v = typeof c === "string" ? value ?? "" : c.value;
      // Un autre compte s'ouvre sur ce téléphone : on garde l'ancien dans la liste des comptes.
      if (name === "nr_session") rememberSession(kv.get("nr_session"));
      kv.set(name, v);
    },
    delete: (name: string) => kv.del(name),
  };
  constructor(data: unknown, init?: { status?: number }) {
    this.data = data;
    this.status = init?.status ?? 200;
  }
  get ok() {
    return this.status < 400;
  }
  static json(data: unknown, init?: { status?: number }) {
    return new NextResponse(data, init);
  }
}

export class NextRequest {
  constructor(
    public url: string,
    public method: string,
    private payload: unknown,
  ) {}
  cookies = { get: (name: string) => (kv.get(name) ? { name, value: kv.get(name)! } : undefined) };
  headers = { get: (_: string) => null as string | null };
  async json() {
    if (this.payload === undefined || this.payload instanceof FormData) throw new Error("no json");
    return this.payload;
  }
  async formData() {
    if (!(this.payload instanceof FormData)) throw new Error("no form");
    return this.payload;
  }
}
