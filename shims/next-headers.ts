// Remplace next/headers : les « cookies » de l'appareil sont gardés dans le téléphone.
import { kv } from "@/lib/local/store-core";

export async function cookies() {
  return {
    get: (name: string) => {
      const value = kv.get(name);
      return value ? { name, value } : undefined;
    },
  };
}

export async function headers() {
  return { get: (name: string) => (name === "host" ? location.host : null) };
}
