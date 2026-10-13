import { useSyncExternalStore } from "react";
import { back, getRoute, getRouteVersion, navigate, subscribeRoute } from "@/lib/local/router";
import { refreshPages } from "@/lib/local/store-core";

// Remplace next/navigation pour l'application téléphone.

export class RedirectSignal extends Error {
  constructor(public to: string) {
    super("redirect");
  }
}
export class NotFoundSignal extends Error {
  constructor() {
    super("not-found");
  }
}

export function redirect(to: string): never {
  throw new RedirectSignal(to);
}
export function notFound(): never {
  throw new NotFoundSignal();
}

export function useRouter() {
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, true),
    back: () => back(),
    refresh: () => refreshPages(),
    prefetch: () => undefined,
  };
}

function useRoute() {
  useSyncExternalStore(subscribeRoute, getRouteVersion, getRouteVersion);
  return getRoute();
}

export function usePathname() {
  return useRoute().path;
}

export function useSearchParams() {
  return useRoute().query;
}
