export interface TrainingRecord {
  name: string;
  date: string;
  module: string;
}

export function filterByDateRange(data: TrainingRecord[], from: string, to: string): TrainingRecord[] {
  return data.filter(d => d.date >= from && d.date <= to);
}

export function aggregateByKey(data: TrainingRecord[], keyField: keyof TrainingRecord): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of data) {
    const key = String(item[keyField]);
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

export function prepareChartData(obj: Record<string, number>) {
  return { labels: Object.keys(obj), values: Object.values(obj) };
}
