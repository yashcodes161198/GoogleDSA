export type Cursor = { created_at: string; id: string };
export const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function readCursor(params: URLSearchParams): Cursor | null {
  const created_at = params.get("before");
  const id = params.get("id");
  if (created_at === null && id === null) return null;
  if (!created_at || !id || !UUID_PATTERN.test(id) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(created_at) ||
      !Number.isFinite(Date.parse(created_at))) throw new Error("Invalid page cursor");
  return { created_at, id };
}

export function cursorPage<T extends Cursor>(rows: T[], size: number) {
  const items = rows.slice(0, size);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > size && last ? { created_at: last.created_at, id: last.id } : null };
}

export function beforeCursor(row: Cursor, cursor: Cursor | null) {
  return !cursor || row.created_at < cursor.created_at || (row.created_at === cursor.created_at && row.id < cursor.id);
}

export function pageParams(cursor: Cursor | null) {
  const params = new URLSearchParams();
  if (cursor) { params.set("before", cursor.created_at); params.set("id", cursor.id); }
  return params;
}
