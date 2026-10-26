// PostgREST caps each response. Always request every page in a stable order.
export async function readAllRows<T>(query: (from: number, to: number) => PromiseLike<{data: T[] | null; error: unknown}>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const {data, error} = await query(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}
