// Continue to an empty page: a project may cap responses below our requested size.
export const READ_PAGE_SIZE = 500;

export async function readAllPages<T, K extends string | number>(
  fetchPage: (after: K | null) => PromiseLike<{ data: T[] | null; error: unknown }>,
  key: (row: T) => K,
): Promise<T[]> {
  const rows: T[] = [];
  let after: K | null = null;
  for (;;) {
    const { data, error } = await fetchPage(after);
    if (error) throw error;
    if (!data?.length) return rows;
    const next = key(data[data.length - 1]);
    if (after !== null && next <= after) throw new Error("Library page did not advance");
    rows.push(...data);
    after = next;
  }
}
