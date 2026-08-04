import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", "Datei ist kein PNG.");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
const indexSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const serviceWorkerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const pwaSource = await readFile(new URL("../src/lib/pwa.ts", import.meta.url), "utf8");
const vercelConfig = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

assert.equal(manifest.name, "ULC Linz Oberbank");
assert.equal(manifest.short_name, "ULC Linz");
assert.equal(manifest.id, "/");
assert.equal(manifest.start_url, "/");
assert.equal(manifest.scope, "/");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.theme_color, "#147a46");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, "Manifest-Icons fehlen.");

const expectedIcons = [
  ["/icons/icon-192.png", 192, "any", "38ff7da8ca4c8e7d2f091f757d074b8728bd025d6c18755b9dd14048351c3cad"],
  ["/icons/icon-512.png", 512, "any", "5bc503c34d037643e387e7f9cb259bd3ae9ffd8f98eac2c98d4adf4527b2f71c"],
  ["/icons/icon-maskable-512.png", 512, "maskable", "44502a458ac77bac3d1436fce82e30994f5f9bae2b9e7f8f03240310291f11b0"],
  ["/icons/apple-touch-icon.png", 180, null, "7b60955c0b7d1102f2058b0105c3f53d37a57f9a4b45bc1ef70529f921841a36"],
  ["/icons/favicon-32.png", 32, null, "dcb07aeb9015cfbf08d22e8b0d889ba2f3db20aeafc7a911b68711251dd9b60e"],
];

for (const [src, size, purpose, expectedHash] of expectedIcons) {
  const buffer = await readFile(new URL(`../public${src}`, import.meta.url));
  assert.deepEqual(pngDimensions(buffer), { width: size, height: size }, `Falsche Icon-Größe: ${src}`);
  assert.equal(createHash("sha256").update(buffer).digest("hex"), expectedHash, `Vereinsicon wurde unerwartet verändert: ${src}`);
  if (purpose) {
    const icon = manifest.icons.find((item) => item.src === src);
    assert.ok(icon, `Manifest-Eintrag fehlt: ${src}`);
    assert.equal(icon.sizes, `${size}x${size}`);
    assert.equal(icon.purpose, purpose);
  }
}

for (const marker of [
  'rel="manifest" href="/manifest.webmanifest"',
  'rel="apple-touch-icon"',
  'apple-mobile-web-app-capable',
  'mobile-web-app-capable',
  'theme-color" content="#147a46"',
]) {
  assert.ok(indexSource.includes(marker), `PWA-Metadatum fehlt: ${marker}`);
}

for (const marker of [
  'addEventListener("install"',
  'addEventListener("activate"',
  "caches.delete",
  "self.clients.claim",
]) {
  assert.ok(serviceWorkerSource.includes(marker), `Service-Worker-Lebenszyklus fehlt: ${marker}`);
}
assert.doesNotMatch(serviceWorkerSource, /addEventListener\(["']fetch["']|caches\.open|cache\.put/i, "Service Worker darf keine App- oder Datenanfragen cachen.");
assert.doesNotMatch(serviceWorkerSource, /supabase|authorization|access_token|refresh_token/i, "Service Worker darf keine Supabase- oder Auth-Daten behandeln.");

for (const marker of [
  "import.meta.env.PROD",
  'scope: "/"',
  'updateViaCache: "none"',
  "env.appCommit",
]) {
  assert.ok(pwaSource.includes(marker), `Service-Worker-Registrierung ist unvollständig: ${marker}`);
}

const swHeader = vercelConfig.headers.find((rule) => rule.source === "/sw.js");
assert.ok(swHeader, "Vercel-Header für /sw.js fehlen.");
assert.ok(swHeader.headers.some((header) => header.key === "Cache-Control" && header.value.includes("no-cache")), "Service Worker muss ohne HTTP-Cache aktualisiert werden.");
assert.ok(swHeader.headers.some((header) => header.key === "Service-Worker-Allowed" && header.value === "/"), "Service-Worker-Scope-Header fehlt.");
const manifestHeader = vercelConfig.headers.find((rule) => rule.source === "/manifest.webmanifest");
assert.ok(manifestHeader, "Vercel-Header für das Manifest fehlen.");

console.log("PWA-Prüfung erfolgreich: Manifest, Vereinsicons, Standalone-Modus, cachefreier Service Worker und Vercel-Header sind gültig.");
