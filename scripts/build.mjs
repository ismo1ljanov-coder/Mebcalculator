// Kutubxonasiz build: TypeScript turlarini olib tashlab, brauzer uchun oddiy ES modullar hosil qiladi.
// Node 22.13+ kerak (node:module.stripTypeScriptTypes).
import { stripTypeScriptTypes } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from "node:fs";
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
for (const f of ["index.html", "styles.css"]) copyFileSync(join(src, f), join(dist, f));
console.log(`dist/ tayyor: ${count} ta modul + index.html + styles.css`);
