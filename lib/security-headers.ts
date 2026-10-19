export const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

export function contentSecurityPolicy(nonce: string, supabaseUrl: string, development: boolean) {
  const origin = new URL(supabaseUrl).origin;
  const websocket = origin.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Theme variables and React layout styles use style attributes.
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${origin} ${websocket}${development ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`,
    `img-src 'self' ${origin} blob: data:`,
    "font-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
