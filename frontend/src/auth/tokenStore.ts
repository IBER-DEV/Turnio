const ACCESS_KEY = "turnio.access";
const REFRESH_KEY = "turnio.refresh";

/**
 * Guarda los tokens en localStorage. Para la app Capacitor (Fase 1+)
 * lo ideal es migrar a @capacitor/preferences (storage nativo más
 * seguro que localStorage), pero para esta primera versión web se
 * mantiene simple.
 */
export const tokenStore = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  setAccess(access: string): void {
    localStorage.setItem(ACCESS_KEY, access);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
