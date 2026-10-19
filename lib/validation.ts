export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
}

export function requireUuid(value: unknown): asserts value is string {
  if (!isUuid(value)) throw new Error("Invalid identifier");
}

export function requireBoolean(value: unknown): asserts value is boolean {
  if (typeof value !== "boolean") throw new Error("Invalid boolean value");
}

export function requireIds(value: unknown, maximum: number): asserts value is string[] {
  if (!Array.isArray(value) || value.length > maximum || !value.every(isUuid)) {
    throw new Error("Invalid question list");
  }
}

export function isSolveSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 86400;
}
