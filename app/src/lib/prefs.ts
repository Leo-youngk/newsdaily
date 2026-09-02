// 本地偏好：主题、收藏、已读、管理令牌、显示设置（全部存 localStorage，不占 D1 写额度）

const KEY = {
  theme: 'np-theme',
  favorites: 'np-favorites',
  read: 'np-read',
  adminToken: 'np-admin-token',
  density: 'np-density',
  sort: 'np-sort',
  autoTranslate: 'np-auto-translate',
  categoryOrder: 'np-category-order',
};

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export type ThemeMode = 'system' | 'light' | 'dark';

export const prefs = {
  // 主题
  getTheme(): ThemeMode {
    return (localStorage.getItem(KEY.theme) as ThemeMode) || 'system';
  },
  setTheme(mode: ThemeMode): void {
    if (mode === 'system') localStorage.removeItem(KEY.theme);
    else localStorage.setItem(KEY.theme, mode);
    applyTheme(mode);
  },
  // 收藏
  getFavorites(): Set<string> {
    return readSet(KEY.favorites);
  },
  toggleFavorite(id: string): Set<string> {
    const s = readSet(KEY.favorites);
    s.has(id) ? s.delete(id) : s.add(id);
    writeSet(KEY.favorites, s);
    return s;
  },
  // 已读
  getRead(): Set<string> {
    return readSet(KEY.read);
  },
  markRead(id: string): Set<string> {
    const s = readSet(KEY.read);
    s.add(id);
    writeSet(KEY.read, s);
    return s;
  },
  clearRead(): void {
    localStorage.removeItem(KEY.read);
  },
  // 管理令牌（用于 PUT /api/config）
  getAdminToken(): string {
    return localStorage.getItem(KEY.adminToken) || '';
  },
  setAdminToken(token: string): void {
    token
      ? localStorage.setItem(KEY.adminToken, token)
      : localStorage.removeItem(KEY.adminToken);
  },
  // 显示设置
  getDensity(): 'compact' | 'standard' {
    return (localStorage.getItem(KEY.density) as 'compact' | 'standard') || 'standard';
  },
  setDensity(v: 'compact' | 'standard'): void {
    localStorage.setItem(KEY.density, v);
  },
  getSort(): 'time' | 'source' {
    return (localStorage.getItem(KEY.sort) as 'time' | 'source') || 'time';
  },
  setSort(v: 'time' | 'source'): void {
    localStorage.setItem(KEY.sort, v);
  },
  getAutoTranslate(): boolean {
    return localStorage.getItem(KEY.autoTranslate) === '1';
  },
  setAutoTranslate(v: boolean): void {
    v
      ? localStorage.setItem(KEY.autoTranslate, '1')
      : localStorage.removeItem(KEY.autoTranslate);
  },
  getCategoryOrder(): string[] | null {
    try {
      const raw = localStorage.getItem(KEY.categoryOrder);
      return raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      return null;
    }
  },
  setCategoryOrder(order: string[]): void {
    localStorage.setItem(KEY.categoryOrder, JSON.stringify(order));
  },
};

/** 根据模式给 <html> 加/去 dark class */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  const dark =
    mode === 'dark' ||
    (mode === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
}
