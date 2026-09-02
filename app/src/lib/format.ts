// 展示辅助：相对时间、分类色点

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fullDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

// 分类对应的克制色点（低饱和，Substack 式）
const CATEGORY_DOT: Record<string, string> = {
  访谈: '#a9694f',
  AI: '#7c6bb0',
  科技: '#4a7ba6',
  商业: '#b08a3e',
  思想: '#5a9178',
};

export function categoryColor(category: string): string {
  return CATEGORY_DOT[category] ?? '#8a857c';
}

/** 阅读时长：给长文一个诚实的预期，这是深度阅读器最该显示的数字 */
export function readingLabel(minutes: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

/** 播客时长 */
export function durationLabel(sec?: number): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}` : `${m} 分钟`;
}
