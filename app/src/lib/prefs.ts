// 本地偏好：主题、收藏、已读、显示设置（全部存 localStorage，不占 D1 写额度）

const KEY = {
  theme: 'np-theme',
  favorites: 'np-favorites',
  read: 'np-read',
  density: 'np-density',
  sort: 'np-sort',
  autoTranslate: 'np-auto-translate',
  categoryOrder: 'np-category-order',
  fontScale: 'np-font-scale',
  progress: 'np-progress',
};

/** 阅读字号档位 */
export type FontScale = 's' | 'm' | 'l' | 'xl';

/**
 * 阅读进度：id -> 已读比例(0~1)。
 * 存比例而不是像素，因为字号可调、窗口宽度会变，像素位置换个环境就没意义了。
 * 只记"读到一半"的：读完的删掉，免得卡片上永远挂着"读到 99%"。
 */
const PROGRESS_MAX = 300;

function readProgress(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY.progress);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}

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
    localStorage.setItem(KEY.favorites, JSON.stringify([...s]));
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
  // 阅读进度
  getProgress(): Record<string, number> {
    return readProgress();
  },
  setProgress(id: string, ratio: number): void {
    const all = readProgress();
    // 读完（或几乎没开始）就不必记，省得列表里全是噪声
    if (ratio >= 0.98 || ratio <= 0.02) delete all[id];
    else {
      delete all[id]; // 先删再写，让键的插入顺序等于最近使用顺序
      all[id] = Math.round(ratio * 100) / 100;
    }
    const keys = Object.keys(all);
    if (keys.length > PROGRESS_MAX) {
      for (const k of keys.slice(0, keys.length - PROGRESS_MAX)) delete all[k];
    }
    try {
      localStorage.setItem(KEY.progress, JSON.stringify(all));
    } catch {
      // 配额满了就算了，进度不是必须品，不能因此让阅读页崩掉
    }
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
  getFontScale(): FontScale {
    const v = localStorage.getItem(KEY.fontScale) as FontScale | null;
    return v && ['s', 'm', 'l', 'xl'].includes(v) ? v : 'm';
  },
  setFontScale(v: FontScale): void {
    localStorage.setItem(KEY.fontScale, v);
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
