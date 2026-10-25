# MebCalculator

Mebelchi ustalar uchun hisob-kitob: o'lcham → LDSP/kant/DVP/furnitura, raskroy sxemasi, narx.

## Joylashtirish (domeningizga)
`dist/` papkasining ichidagi hamma narsani hostingga yuklang (Netlify, Cloudflare Pages, GitHub Pages yoki oddiy hosting).
Server kerak emas, bu statik sayt.

## Ishlab chiqish
- `npm test` — hisob va chizma testlari (Node 22.13+)
- `npm run build` — `src/` dan `dist/` hosil qiladi (kutubxonasiz)

Hisob yadrosi: `src/core/` (binPacking, edge, templates, calculator).

## Avtomatik joylashtirish
- **GitHub Pages:** Settings → Pages → Source: "GitHub Actions". Har `main`ga push qilinganda sayt yangilanadi.
- **Netlify / Cloudflare Pages:** build command `npm run build`, publish directory `dist`.
Domen: hosting sozlamalaridan o'z domeningizni ulang.
