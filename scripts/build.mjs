// Kutubxonasiz build: TypeScript turlarini olib tashlab, brauzer uchun oddiy ES modullar hosil qiladi.
// Node 22.13+ kerak (node:module.stripTypeScriptTypes).
import { stripTypeScriptTypes } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });

let count = 0;
for (const dir of ["core", "ui"]) {
  mkdirSync(join(dist, dir), { recursive: true });
  for (const f of readdirSync(join(src, dir))) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
    const code = readFileSync(join(src, dir, f), "utf8");
    let js = stripTypeScriptTypes(code, { mode: "strip" });
    js = js.replace(/(from\s+["'][^"']+)\.ts(["'])/g, "$1.js$2");
    writeFileSync(join(dist, dir, f.replace(/\.ts$/, ".js")), js);
    count++;
  }
}
const statics = ["index.html", "styles.css", "manifest.webmanifest", "icon.svg"];
for (const f of statics) copyFileSync(join(src, f), join(dist, f));
mkdirSync(join(dist, "icons"), { recursive: true });
const icons = existsSync(join(src, "icons")) ? readdirSync(join(src, "icons")) : [];
for (const f of icons) copyFileSync(join(src, "icons", f), join(dist, "icons", f));

// Oflayn ishlash uchun service worker: tarmoq birinchi, bo'lmasa kesh. Versiya har buildda yangilanadi.
const files = [
  "./",
  ...statics,
  ...icons.map((f) => `icons/${f}`),
  ...readdirSync(join(dist, "core")).map((f) => `core/${f}`),
  ...readdirSync(join(dist, "ui")).map((f) => `ui/${f}`),
];
const sw = `const CACHE = "meb-${Date.now()}";
const FILES = ${JSON.stringify(files)};
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(FILES.map((f) => c.add(f)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("./"))),
  );
});
`;
writeFileSync(join(dist, "sw.js"), sw);
console.log(`dist/ tayyor: ${count} ta modul, ${files.length} ta fayl keshlanadi`);
