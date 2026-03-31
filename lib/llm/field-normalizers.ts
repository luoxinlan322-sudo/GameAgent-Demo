import {
  ZodArray,
  ZodBoolean,
  ZodDefault,
  ZodEnum,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodString,
  type ZodType,
} from "zod";

export function unwrapSchema(schema: ZodType<unknown>): ZodType<unknown> {
  let current = schema;

  while (current instanceof ZodOptional || current instanceof ZodDefault || current instanceof ZodNullable) {
    const innerType = (current as unknown as { _def?: { innerType?: ZodType<unknown> } })._def?.innerType;
    if (!innerType) break;
    current = innerType;
  }

  return current;
}

export function splitListLikeString(value: string) {
  return value
    .split(/\r?\n|[；;。]|(?<=\S)\s*[-•·]\s*|、|，|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
}

export function normalizeString(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((item) => normalizeString(item)).join("；");
  if (value === null || value === undefined) return value;
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function normalizeNumber(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return value;
}

export function normalizeBoolean(value: unknown): unknown {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "yes", "1", "pass", "approved"].includes(lower)) return true;
    if (["false", "no", "0", "fail", "rejected"].includes(lower)) return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return value;
}

export function normalizeValueForSchema(schema: ZodType<unknown>, value: unknown): unknown {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof ZodString) return normalizeString(value);
  if (unwrapped instanceof ZodNumber) return normalizeNumber(value);
  if (unwrapped instanceof ZodBoolean) return normalizeBoolean(value);
  if (unwrapped instanceof ZodEnum) return typeof value === "string" ? value.trim() : normalizeString(value);

  if (unwrapped instanceof ZodArray) {
    const itemSchema = unwrapped.element as unknown as ZodType<unknown>;
    let list: unknown;

    if (Array.isArray(value)) {
      list = value;
    } else if (typeof value === "string" && unwrapSchema(itemSchema) instanceof ZodString) {
      list = splitListLikeString(value);
    } else if (value === undefined || value === null) {
      list = value;
    } else {
      list = [value];
    }

    if (!Array.isArray(list)) return list;
    return list.map((item) => normalizeValueForSchema(itemSchema, item));
  }

  if (unwrapped instanceof ZodObject) {
    const shape = unwrapped.shape;
    const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const normalized: Record<string, unknown> = {};

    for (const [key, childSchema] of Object.entries(shape)) {
      normalized[key] = normalizeValueForSchema(childSchema as ZodType<unknown>, record[key]);
    }

    return normalized;
  }

  return value;
}

export function cleanStringArrayField(record: Record<string, unknown>, field: string, options: { min?: number; max?: number; maxItems?: number }) {
  const raw = record[field];
  let list: string[] = [];

  if (Array.isArray(raw)) {
    list = raw.flatMap((item) => (typeof item === "string" ? splitListLikeString(item) : [String(item ?? "").trim()]));
  } else if (typeof raw === "string") {
    list = splitListLikeString(raw);
  }

  const min = options.min ?? 1;
  const max = options.max ?? 120;
  const maxItems = options.maxItems ?? list.length;

  record[field] = list
    .map((item) => truncateText(item, max))
    .map((item) => item.trim())
    .filter((item) => item.length >= min)
    .slice(0, maxItems);
}

export function cleanStringField(record: Record<string, unknown>, field: string, maxLength: number) {
  const raw = record[field];
  if (raw === undefined || raw === null) return;
  const normalized = normalizeString(raw);
  if (typeof normalized === "string") {
    record[field] = truncateText(normalized, maxLength);
  }

}

export function cleanObjectArrayField(record: Record<string, unknown>, field: string, maxItems: number, itemCleaner: (item: Record<string, unknown>) => Record<string, unknown>) {
  const raw = record[field];
  if (!Array.isArray(raw)) return;
  record[field] = raw
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .slice(0, maxItems)
    .map((item) => itemCleaner({ ...(item as Record<string, unknown>) }));
}

export function cleanBooleanField(record: Record<string, unknown>, field: string, fallback = false) {
  const normalized = normalizeBoolean(record[field]);
  record[field] = typeof normalized === "boolean" ? normalized : fallback;
}

export function cleanEnumField(
  record: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
  fallback: string,
) {
  const raw = record[field];
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const matched = allowed.find((item) => item.toLowerCase() === normalized);
  record[field] = matched ?? fallback;
}

