import assert from "node:assert/strict";
import { localModeFromEnvironment } from "../lib/local-mode";
assert.equal(localModeFromEnvironment({ USE_LOCAL_DB:"true",NODE_ENV:"development" }),true);
assert.equal(localModeFromEnvironment({ NEXT_PUBLIC_USE_LOCAL_DB:"true",NODE_ENV:"development" }),false);
assert.equal(localModeFromEnvironment({ USE_LOCAL_DB:"false",VERCEL:"1",NODE_ENV:"production" }),false);
const fixture={ USE_LOCAL_DB:"true",NODE_ENV:"production",GOOGLEDSA_LOCAL_TEST:"true",GOOGLEDSA_BIND_HOST:"127.0.0.1" };
assert.equal(localModeFromEnvironment(fixture),true);
assert.throws(()=>localModeFromEnvironment({ ...fixture,GOOGLEDSA_BIND_HOST:"0.0.0.0" }),/forbidden/);
for (const flag of ["USE_LOCAL_DB","NEXT_PUBLIC_USE_LOCAL_DB"]) {
  assert.throws(()=>localModeFromEnvironment({ [flag]:"true",NODE_ENV:"production" }),/forbidden/);
  for (const platform of ["VERCEL","VERCEL_ENV","NETLIFY","AWS_LAMBDA_FUNCTION_NAME","K_SERVICE","RENDER","FLY_APP_NAME","WEBSITE_INSTANCE_ID","CF_PAGES"]) {
    assert.throws(()=>localModeFromEnvironment({ ...fixture,[flag]:"true",[platform]:"preview" }),/forbidden/);
  }
}
console.log("Local mode rejects hosted/production bypass flags and permits explicit loopback fixtures");
