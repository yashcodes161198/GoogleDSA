# Admin access for adding questions

Only accounts with **`app_metadata.role = "admin"`** can add shared catalog questions in production. Regular signed-in users can read the catalog and track progress only.

## Local development

With the server flag `USE_LOCAL_DB=true` during local development, the app signs you in automatically as:

- **Email:** `admin@local.dev`
- **Password:** none (login is bypassed)

That account can use **Add question** without extra setup.

The public `NEXT_PUBLIC_USE_LOCAL_DB` flag cannot enable authentication bypass. Both flags must be false on hosted deployments. Configuration loading rejects bypass flags on hosted platforms and ordinary production builds. For an intentional local-memory production fixture, build with `GOOGLEDSA_LOCAL_TEST=true`, `GOOGLEDSA_BIND_HOST=127.0.0.1` and `USE_LOCAL_DB=true`, then run `node scripts/local-test-server.mjs`; this launcher binds only to loopback.

Discussion media uploads use the server storage credential at runtime after validating and re-encoding the image. Text comments do not require that credential. Schedule `node scripts/cleanup-comment-media.mjs` in a trusted maintenance environment to remove abandoned and deleted-account attachments and release unused reservations. This command requires the Supabase URL and server credential in its environment and must never run in a browser.

## Production (Supabase)

1. Sign up or sign in once with the account that should be admin (email/password or Google).
2. In the Supabase Dashboard, open **SQL Editor** and run (replace the email):

```sql
UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE email = 'you@example.com';
```

3. Apply migration **`012_problems_admin_insert_policy.sql`** if you have not already (it removes the old “any authenticated user can insert” policy).
4. Sign out and sign back in so the JWT includes the new `app_metadata`.

The admin keeps the password they chose at signup. The app never stores or displays production passwords.

To remove admin access:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data - 'role'
WHERE email = 'you@example.com';
```
