import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
export const migrationFiles = [
  "020_trusted_progress.sql", "021_comment_timestamps.sql",
  "022_discussion_quotas.sql", "023_atomic_interviews.sql",
];
const repairPath = path.join(root, "supabase/repairs/comment_media_prerequisites.sql");

export async function buildSecurityMigrationBundle() {
  const parts = [
    "-- GoogleDSA corrected security migrations 020-023, including missing comment-media prerequisites.",
    "-- Requires migrations 001-017. Apply once; do not also run the individual files.",
    "-- Run with an administrator/migration connection. Includes no credential rotation.",
    "BEGIN;",
    `DO $preflight$
BEGIN
  IF to_regclass('public.leaderboard_comments') IS NULL THEN
    RAISE EXCEPTION 'Apply migrations 001-017 before this bundle';
  END IF;
  IF to_regclass('private.problem_award_state') IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 020 is already present. Do not rerun this combined bundle; check which individual migrations remain.';
  END IF;
END;
$preflight$;`,
    "-- Prerequisite repair for missing/partial migrations 018 and 019.",
    await readFile(repairPath, "utf8"),
  ];
  for (const name of migrationFiles) {
    parts.push(`-- Migration: ${name}`, await readFile(path.join(root, "supabase/migrations", name), "utf8"));
  }
  parts.push("COMMIT;\n");
  return parts.join("\n\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error("Usage: node scripts/bundle-security-migrations.mjs <output-directory>");
  const output = path.resolve(process.argv[2]);
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "apply-migrations-020-023.sql"), await buildSecurityMigrationBundle());
  await copyFile(repairPath, path.join(output, "comment_media_prerequisites.sql"));
  for (const name of migrationFiles) await copyFile(path.join(root, "supabase/migrations", name), path.join(output, name));
  await writeFile(path.join(output, "README.md"), `# Corrected security migration bundle

Run the whole apply-migrations-020-023.sql in one SQL execution using an administrator/migration connection. It repairs missing or partial comment-media prerequisites from 018/019, then applies 020, 021, 022 and 023 inside one BEGIN/COMMIT transaction. Existing comments are preserved. It does not rotate or contain secrets.

Requires migrations 001-017; 020-023 must not have committed already. A failure of the previous combined transactional file prevents its changes from committing. If your SQL connection reports an aborted transaction, issue ROLLBACK first, then run this replacement file in full. Do not run both the combined file and its individual copies.

For a migration runner, first apply supabase/repairs/comment_media_prerequisites.sql, then apply outstanding original migration files in order. Manual SQL execution does not update the runner's migration history automatically. The standalone repair is safe to repeat; the complete bundle is intended to run once.

The migration-020 preflight guard stops reruns after a successful application. Coordinate with the new application because these migrations revoke old direct-write APIs. Live Storage and multi-connection staging verification remain deployment gates.
`);
  console.log(`Created corrected migration bundle in ${output}`);
}
