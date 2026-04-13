export const STORAGE_KEYS = {
  reports: "knife-truck.user-reports.v1",
  alerts: "knife-truck.user-alerts.v1",
};

export function readLocalRows<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalRows<T>(key: string, rows: T[]) {
  window.localStorage.setItem(key, JSON.stringify(rows));
}
