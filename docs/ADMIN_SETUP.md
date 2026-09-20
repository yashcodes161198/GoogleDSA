# Admin access for adding questions

Only accounts with **`app_metadata.role = "admin"`** can add shared catalog questions in production. Regular signed-in users can read the catalog and track progress only.

## Local development

With `USE_LOCAL_DB=true` (or `NEXT_PUBLIC_USE_LOCAL_DB=true`), the app signs you in automatically as:

- **Email:** `admin@local.dev`
- **Password:** none (login is bypassed)

That account can use **Add question** without extra setup.

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
