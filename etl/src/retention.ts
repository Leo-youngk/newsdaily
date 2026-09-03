/** 索引和清理必须使用同一组保留分片，避免目录请求已经删除的数据。 */
export function retainedDates(keys: string[], cutoff: number): string[] {
  return [...new Set(keys.map((key) => key.match(/^items\/(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
    .filter((date): date is string => !!date && Date.parse(date) >= cutoff))]
    .sort((a, b) => b.localeCompare(a));
}
