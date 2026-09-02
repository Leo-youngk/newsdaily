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

// 分类对应的克制色点（Substack 式：低饱和）
const CATEGORY_DOT: Record<string, string> = {
  科技: '#4a7ba6',
  AI: '#7c6bb0',
  财经: '#b08a3e',
  国际: '#5a9178',
  开源: '#a9694f',
  自定义: '#8a857c',
};

export function categoryColor(category: string): string {
  return CATEGORY_DOT[category] ?? '#8a857c';
}
