export const now = () => Date.now();

export const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
};

export const safeJsonParse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const clampNumber = (value: number | undefined, min: number, max: number) => {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return Math.min(max, Math.max(min, value));
};
