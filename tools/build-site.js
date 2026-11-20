#!/usr/bin/env node
// Builds the public site into public/ for Firebase Hosting (no dependencies).
// こもれびの庭 (not a game-kit 3D game): copies the flat game files (index.html, *.js, style.css, game.json, ui/) and assets/og-image.png
// - injects SEO meta, OGP / Twitter card, JSON-LD and (when site.json has gaId) the GA4 tag
//   (site.json: name, nameEn, domain, description, ogImage, gaId, titleSuffix, genre, ogImageAlt, author, authorUrl)
// - writes robots.txt, sitemap.xml, 404.html and the Search Console verification file
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
const origin = `https://${site.domain}`;
const url = `${origin}/`;
const ogImage = origin + site.ogImage;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let lastmod;
try {
  lastmod = execSync('git log -1 --format=%cs', { cwd: ROOT }).toString().trim();
} catch {
  lastmod = new Date().toISOString().slice(0, 10);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
// files starting with "_" (local check sheets) are not published
const published = (src) => !path.basename(src).startsWith('_');
for (const dir of ['ui']) fs.cpSync(path.join(ROOT, dir), path.join(OUT, dir), { recursive: true, filter: published });
for (const f of ['game.js', 'models.js', 'scene.js', 'sky.js', 'share-bar.js', 'style.css', 'game.json']) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
if (fs.existsSync(path.join(ROOT, 'assets/og-image.png'))) fs.copyFileSync(path.join(ROOT, 'assets/og-image.png'), path.join(OUT, 'og-image.png'));

// site.json: titleSuffix (after the name), genre (JSON-LD), ogImageAlt
const title = site.titleSuffix ? `${site.name}｜${site.titleSuffix}` : site.name;
const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${url}#website`, url, name: site.name, inLanguage: 'ja', publisher: { '@id': `${url}#org` } },
    { '@type': 'Organization', '@id': `${url}#org`, name: site.author, url: site.authorUrl },
    {
      '@type': 'VideoGame',
      name: site.name,
      alternateName: site.nameEn,
      url,
      description: site.description,
      image: ogImage,
      genre: site.genre || ['ゲーム'],
      gamePlatform: ['Web browser', 'PC', 'Smartphone', 'Tablet'],
      applicationCategory: 'Game',
      operatingSystem: 'Any (modern web browser)',
      playMode: 'SinglePlayer',
      inLanguage: 'ja',
      dateModified: lastmod,
      author: { '@id': `${url}#org` },
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'JPY' },
    },
  ],
};

const head = [
  `<meta name="description" content="${esc(site.description)}">`,
  `<link rel="canonical" href="${url}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:site_name" content="${esc(site.name)}">`,
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:description" content="${esc(site.description)}">`,
  `<meta property="og:url" content="${url}">`,
  `<meta property="og:locale" content="ja_JP">`,
  `<meta property="og:image" content="${ogImage}">`,
  `<meta property="og:image:width" content="1200">`,
  `<meta property="og:image:height" content="630">`,
  `<meta property="og:image:type" content="image/png">`,
  `<meta property="og:image:alt" content="${esc(site.ogImageAlt || site.name)}">`,
  `<meta name="twitter:card" content="summary_large_image">`,
  `<meta name="twitter:title" content="${esc(title)}">`,
  `<meta name="twitter:description" content="${esc(site.description)}">`,
  `<meta name="twitter:image" content="${ogImage}">`,
  site.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(site.googleSiteVerification)}">` : '',
  `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`,
  site.gaId
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${site.gaId}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${site.gaId}');</script>`
    : '',
]
  .filter(Boolean)
  .join('\n');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<meta name="description"[^>]*>\s*/, '');
if (site.noscript) html = html.replace('<body>', `<body>
<noscript><p style="padding:16px;font-size:16px">${esc(site.noscript)}</p></noscript>`);
html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>\n${head}`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);

fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
fs.writeFileSync(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url}</loc><lastmod>${lastmod}</lastmod></url>\n</urlset>\n`,
);
fs.writeFileSync(
  path.join(OUT, '404.html'),
  `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>見つかりません｜${esc(site.name)}</title><meta name="robots" content="noindex"><link rel="icon" href="/ui/island.png" type="image/png">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8f6e9;color:#334536;font-family:system-ui,sans-serif;text-align:center;padding:16px}a{color:#496845;font-weight:700}</style>
</head><body><div><p style="font-size:20px">このページは、庭のどこにも見つかりませんでした。</p><p><a href="/">ひだまり島へもどる</a></p></div></body></html>
`,
);
// Search Console HTML-file verification: put google<token>.html in tools/ and it is copied as is
for (const f of fs.readdirSync(__dirname)) if (/^google[0-9a-f]+\.html$/.test(f)) fs.copyFileSync(path.join(__dirname, f), path.join(OUT, f));

// minified public build (standard 1.3): comments and white space out of js / css (tools/minify.js). `--minify` or "minify": true in site.json; `--no-minify` turns it off.
let minNote = '';
if ((process.argv.includes('--minify') || site.minify === true) && !process.argv.includes('--no-minify') && fs.existsSync(path.join(__dirname, 'minify.js'))) {
  const r = require('./minify.js').minifyDir(OUT);
  minNote = `, minified ${r.files} files ${Math.round(r.before / 1024)} -> ${Math.round(r.after / 1024)} KB`;
}

console.log(`built ${path.relative(ROOT, OUT)}/ for ${url} (lastmod ${lastmod}, GA ${site.gaId || 'off'}${minNote})`);
