import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const REQUIRED_HEADERS = new Map([
  ["content-security-policy", null],
  ["strict-transport-security", "max-age=31536000"],
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["referrer-policy", "no-referrer"],
  ["permissions-policy", null],
  ["x-permitted-cross-domain-policies", "none"],
  ["x-xss-protection", "0"],
]);

function normalizeHeaderName(value) {
  return value.trim().toLowerCase();
}

function parseCsp(value) {
  const directives = new Map();
  for (const part of value.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const [name, ...sources] = tokens;
    assert.ok(!directives.has(name), `CSP-Direktive ist doppelt vorhanden: ${name}`);
    directives.set(name, sources);
  }
  return directives;
}

function expectDirective(directives, name, expectedSources) {
  assert.ok(directives.has(name), `CSP-Direktive fehlt: ${name}`);
  assert.deepEqual(directives.get(name), expectedSources, `CSP-Direktive ist unerwartet: ${name}`);
}

function validateCsp(value) {
  const directives = parseCsp(value);

  expectDirective(directives, "default-src", ["'self'"]);
  expectDirective(directives, "base-uri", ["'self'"]);
  expectDirective(directives, "form-action", ["'self'"]);
  expectDirective(directives, "frame-ancestors", ["'none'"]);
  expectDirective(directives, "object-src", ["'none'"]);
  expectDirective(directives, "script-src", ["'self'"]);
  expectDirective(directives, "style-src", ["'self'", "'unsafe-inline'"]);
  expectDirective(directives, "img-src", [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    "https://*.storage.supabase.co",
  ]);
  expectDirective(directives, "font-src", ["'self'", "data:"]);
  expectDirective(directives, "connect-src", [
    "'self'",
    "https://*.supabase.co",
    "https://*.storage.supabase.co",
    "wss://*.supabase.co",
  ]);
  expectDirective(directives, "media-src", [
    "'self'",
    "blob:",
    "https://*.supabase.co",
    "https://*.storage.supabase.co",
  ]);
  expectDirective(directives, "worker-src", ["'self'", "blob:"]);
  expectDirective(directives, "child-src", ["'self'", "blob:"]);
  expectDirective(directives, "manifest-src", ["'self'"]);
  expectDirective(directives, "frame-src", ["'none'"]);
  expectDirective(directives, "upgrade-insecure-requests", []);

  const scriptSources = directives.get("script-src") ?? [];
  for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'", "data:", "blob:", "*"]) {
    assert.ok(!scriptSources.includes(forbidden), `Unsichere script-src-Freigabe: ${forbidden}`);
  }

  for (const [name, sources] of directives) {
    assert.ok(!sources.includes("*"), `Globale CSP-Wildcard ist nicht erlaubt: ${name}`);
    assert.ok(!sources.includes("http:"), `Unsicheres HTTP-Schema ist nicht erlaubt: ${name}`);
    assert.ok(!sources.includes("https:"), `Zu breite HTTPS-Freigabe ist nicht erlaubt: ${name}`);
  }
}

function validatePermissionsPolicy(value) {
  for (const required of [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "fullscreen=(self)",
    "picture-in-picture=(self)",
    "screen-wake-lock=(self)",
  ]) {
    assert.ok(value.includes(required), `Permissions-Policy-Eintrag fehlt: ${required}`);
  }
}

function validateHeaderMap(headers, sourceLabel) {
  for (const [name, exactValue] of REQUIRED_HEADERS) {
    assert.ok(headers.has(name), `${sourceLabel}: Sicherheitsheader fehlt: ${name}`);
    const actual = headers.get(name);
    assert.equal(typeof actual, "string", `${sourceLabel}: Headerwert fehlt: ${name}`);
    if (exactValue !== null) {
      assert.equal(actual, exactValue, `${sourceLabel}: Unerwarteter Headerwert: ${name}`);
    }
  }

  validateCsp(headers.get("content-security-policy"));
  validatePermissionsPolicy(headers.get("permissions-policy"));
}

async function validateStaticConfiguration() {
  const raw = await readFile(new URL("../vercel.json", import.meta.url), "utf8");
  const config = JSON.parse(raw);
  assert.ok(Array.isArray(config.headers), "vercel.json enthält keine Headerregeln.");

  const globalRule = config.headers.find((rule) => rule?.source === "/(.*)");
  assert.ok(globalRule, "Globale Vercel-Headerregel /(.*) fehlt.");
  assert.ok(Array.isArray(globalRule.headers), "Globale Vercel-Headerliste fehlt.");

  const headers = new Map();
  for (const header of globalRule.headers) {
    assert.equal(typeof header?.key, "string", "Ungültiger Headername in vercel.json.");
    assert.equal(typeof header?.value, "string", `Headerwert fehlt: ${header?.key ?? "unbekannt"}`);
    const normalized = normalizeHeaderName(header.key);
    assert.ok(!headers.has(normalized), `Sicherheitsheader ist doppelt vorhanden: ${normalized}`);
    headers.set(normalized, header.value);
  }

  validateHeaderMap(headers, "vercel.json");
}

async function validateDeployedUrl(urlValue) {
  const url = new URL(urlValue);
  assert.equal(url.protocol, "https:", "Die veröffentlichte App muss über HTTPS geprüft werden.");

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "user-agent": "ULC-Linz-Security-Header-Check/1.0" },
  });
  assert.ok(response.ok, `Veröffentlichte App antwortet mit HTTP ${response.status}.`);

  const headers = new Map();
  for (const [name, value] of response.headers) headers.set(name.toLowerCase(), value);
  validateHeaderMap(headers, response.url);
}

await validateStaticConfiguration();

const deployedUrl = process.argv[2]?.trim();
if (deployedUrl) {
  await validateDeployedUrl(deployedUrl);
  console.log(`Sicherheitsheader der veröffentlichten App sind gültig: ${deployedUrl}`);
} else {
  console.log("Sicherheitsheader in vercel.json sind gültig.");
}
