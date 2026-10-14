/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_UPDATE_FEED?: string;
  readonly VITE_VIEW_URL?: string;
  readonly VITE_APK_URL?: string;
  readonly VITE_RELEASES_URL?: string;
  readonly VITE_WEB_APP_URL?: string;
  readonly VITE_PWA?: string;
}
