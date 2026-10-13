import type { CapacitorConfig } from "@capacitor/cli";

// Application Android NOS RACINES.
const config: CapacitorConfig = {
  appId: "ci.nosracines.app",
  appName: "Nos Racines",
  webDir: "dist",
  backgroundColor: "#12261A",
  android: {
    backgroundColor: "#12261A",
  },
  plugins: {
    // Les requêtes passent par le téléphone (pas de blocage entre sites) : mises à jour, traduction.
    CapacitorHttp: { enabled: true },
    SplashScreen: { launchShowDuration: 600, backgroundColor: "#12261A", showSpinner: false },
    // Mises à jour gérées par l'application elle-même (voir lib/native/updates.ts).
    // Aucune statistique envoyée à un service extérieur.
    CapacitorUpdater: { autoUpdate: false, appReadyTimeout: 15000, responseTimeout: 60, statsUrl: "", channelUrl: "" },
  },
};

export default config;
