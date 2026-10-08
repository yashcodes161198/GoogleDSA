import { readFileSync } from "node:fs";
import { LOCAL_ADMIN } from "../lib/config";
import { isAdminUser } from "../lib/auth-admin";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const prevLocal = process.env.USE_LOCAL_DB;
const prevPublicLocal = process.env.NEXT_PUBLIC_USE_LOCAL_DB;

function withLocalMode(enabled: boolean, fn: () => void) {
  if (enabled) {
    process.env.USE_LOCAL_DB = "true";
    delete process.env.NEXT_PUBLIC_USE_LOCAL_DB;
  } else {
    delete process.env.USE_LOCAL_DB;
    delete process.env.NEXT_PUBLIC_USE_LOCAL_DB;
  }
  try {
    fn();
  } finally {
    if (prevLocal === undefined) delete process.env.USE_LOCAL_DB;
    else process.env.USE_LOCAL_DB = prevLocal;
    if (prevPublicLocal === undefined) delete process.env.NEXT_PUBLIC_USE_LOCAL_DB;
    else process.env.NEXT_PUBLIC_USE_LOCAL_DB = prevPublicLocal;
  }
}

withLocalMode(true, () => {
  assert(
    isAdminUser({ id: LOCAL_ADMIN.id, email: LOCAL_ADMIN.email }),
    "local admin user is authorized"
  );
  assert(
    !isAdminUser({ id: "other-user", email: "other@example.com" }),
    "non-local user id is not admin in local mode"
  );
});

withLocalMode(false, () => {
  assert(
    isAdminUser({
      id: "uuid",
      email: "admin@prod.com",
      app_metadata: { role: "admin" },
    }),
    "app_metadata.role admin is authorized in production mode"
  );
  assert(
    !isAdminUser({
      id: "uuid",
      email: "user@prod.com",
      app_metadata: {},
    }),
    "missing role is not admin"
  );
  assert(
    !isAdminUser({
      id: "uuid",
      email: "user@prod.com",
      app_metadata: { role: "user" },
    }),
    "non-admin role is rejected"
  );
  assert(!isAdminUser(null), "null user is not admin");
});

const protectedLayout = readFileSync(
  new URL("../app/(protected)/layout.tsx", import.meta.url),
  "utf8"
);
assert(
  protectedLayout.includes("canAddQuestion={isAdminUser(user)}"),
  "protected layout derives session library admin capability on the server"
);
const problemsContent = readFileSync(new URL("../components/ProblemsContent.tsx", import.meta.url), "utf8");
assert(problemsContent.includes("canAddQuestion &&"), "problems page gates Add question link on admin capability");

const newPage = readFileSync(
  new URL("../app/(protected)/problems/new/page.tsx", import.meta.url),
  "utf8"
);
assert(
  newPage.includes("requireAdmin"),
  "new question page requires admin"
);

const actions = readFileSync(
  new URL("../app/actions.ts", import.meta.url),
  "utf8"
);
const addQuestionBlock = actions.slice(
  actions.indexOf("export async function addQuestionAction")
);
assert(
  addQuestionBlock.includes("isAdminUser") &&
    addQuestionBlock.indexOf("isAdminUser") <
      addQuestionBlock.indexOf("parseNewProblemForm"),
  "add question action checks admin before parsing"
);

const migration = readFileSync(
  new URL(
    "../supabase/migrations/012_problems_admin_insert_policy.sql",
    import.meta.url
  ),
  "utf8"
);
assert(
  migration.includes('DROP POLICY IF EXISTS "Authenticated users can insert problems"'),
  "migration removes broad insert policy"
);
assert(
  migration.includes("app_metadata") && migration.includes("'admin'"),
  "migration requires admin role in JWT"
);

console.log("Admin authorization tests passed");
