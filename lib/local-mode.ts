type LocalModeEnvironment = Record<string, string | undefined>;

export function localModeFromEnvironment(env: LocalModeEnvironment): boolean {
  const requested = env.USE_LOCAL_DB === "true" || env.NEXT_PUBLIC_USE_LOCAL_DB === "true";
  if (!requested) return false;
  const hosted = ["VERCEL", "VERCEL_ENV", "NETLIFY", "CONTEXT", "AWS_LAMBDA_FUNCTION_NAME", "K_SERVICE", "RENDER", "FLY_APP_NAME", "WEBSITE_INSTANCE_ID", "CF_PAGES"]
    .some(key => Boolean(env[key]));
  if (hosted || (env.NODE_ENV === "production" &&
      !(env.GOOGLEDSA_LOCAL_TEST === "true" && env.GOOGLEDSA_BIND_HOST === "127.0.0.1"))) {
    throw new Error("Local auth bypass is forbidden on hosted deployments. Loopback production tests require the explicit local test launcher.");
  }
  // A public compatibility flag can trigger an error, but cannot enable authorization bypass.
  return env.USE_LOCAL_DB === "true";
}
