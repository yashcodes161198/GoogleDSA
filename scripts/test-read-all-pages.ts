import assert from "node:assert/strict";
import { readAllPages, READ_PAGE_SIZE } from "../lib/read-all-pages";

async function main() {
  const source = Array.from({ length: 1205 }, (_, index) => ({ id: index + 1 }));
  for (const cap of [READ_PAGE_SIZE, 137, 1000]) {
    const calls: (number | null)[] = [];
    const result = await readAllPages(async after => {
      calls.push(after);
      return { data: source.filter(row => after === null || row.id > after).slice(0, Math.min(cap, READ_PAGE_SIZE)), error: null };
    }, row => row.id);
    assert.deepEqual(result, source);
    assert.equal(new Set(result.map(row => row.id)).size, 1205);
    assert.equal(calls.at(-1), 1205, "an empty page proves completion even below the requested cap");
  }
  await assert.rejects(readAllPages(async after => ({ data: after === null ? [{ id: 1 }] : null, error: after === null ? null : new Error("page failed") }), row => row.id), /page failed/);
  await assert.rejects(readAllPages(async () => ({ data: [{ id: 1 }], error: null }), row => row.id), /did not advance/);
  console.log("Complete reads passed: 1,205 rows, lower service caps, no duplicates, failed later page, nonadvancing cursor");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
