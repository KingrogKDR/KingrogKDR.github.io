#!/usr/bin/env node
/**
 * build-og.js — Pre-render OG / meta tags for every post & series
 *
 * What it does:
 *   1. Reads every blogs/*.json (skipping series.json)
 *   2. For each post, writes  dist/post/{slug}/index.html
 *      — a thin shell with full <head> OG tags + a JS redirect to post.html?slug=…
 *   3. Reads blogs/series.json, for each series writes dist/series/{id}/index.html
 *      — same idea, pointing to series.html?id=…
 *
 * Crawlers (Facebook, Twitter, Slack, etc.) follow the clean URL, get a real
 * <head>, and parse the correct og:image / og:title.  Human visitors are
 * instantly redirected to the SPA page via <meta http-equiv="refresh"> AND
 * a JS redirect so there's no perceptible delay.
 *
 * Usage:
 *   node build-og.js
 *
 * Output:  ./dist/   (commit this folder alongside your site root)
 *
 * Then add these rules to your GitHub Pages / Netlify / Vercel config
 * so the clean URLs serve the pre-rendered shell:
 *
 *   GitHub Pages (can't do server-side rewrites — see note below)
 *   Netlify _redirects:
 *     /post/:slug   /dist/post/:slug/index.html   200
 *     /series/:id   /dist/series/:id/index.html   200
 *
 * GitHub Pages note:
 *   GitHub Pages doesn't support server-side rewrites.  The easiest workaround
 *   is to put the generated files directly at the root as pretty-URL folders:
 *     post/attention-is-infrastructure/index.html
 *   This script writes to ./dist/ by default; change OUTPUT_ROOT below to "."
 *   to write directly into your repo root (safest on GitHub Pages).
 */

const fs = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = "https://kingrogkdr.github.io";   // no trailing slash
const SITE_NAME = "Abhishek Saikia";
const DEFAULT_OG = `${BASE_URL}/images/og-default.png`;
const BLOGS_DIR = path.join(__dirname, "blogs");
const OUTPUT_ROOT = path.join(__dirname);     // change to __dirname for GitHub Pages
// ─────────────────────────────────────────────────────────────────────────────

function esc(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function resolveImage(raw) {
    if (!raw) return DEFAULT_OG;
    if (raw.startsWith("http")) return raw;
    return `${BASE_URL}/${raw.replace(/^\//, "")}`;
}

/**
 * Render a complete static HTML shell.
 * Crawlers read the <head>; humans are bounced to `redirectUrl` instantly.
 */
function shell({ title, description, url, image, type = "website", article = null, redirectUrl }) {
    const fullTitle = `${esc(title)} — ${SITE_NAME}`;
    const safeDesc = esc(description ?? "");
    const safeImage = esc(image);
    const safeUrl = esc(url);

    const articleTags = (article?.tags ?? [])
        .map(t => `  <meta property="article:tag" content="${esc(t)}" />`)
        .join("\n");

    const articleMeta = type === "article" && article ? `
  <meta property="article:published_time" content="${esc(article.publishedTime ?? "")}" />
  <meta property="article:modified_time"  content="${esc(article.modifiedTime ?? article.publishedTime ?? "")}" />
  <meta property="article:author"         content="${esc(article.author ?? SITE_NAME)}" />
${articleTags}` : "";

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${fullTitle}</title>
  <meta name="description" content="${safeDesc}" />
  <link rel="canonical" href="${safeUrl}" />

  <!-- Open Graph -->
  <meta property="og:site_name"   content="${esc(SITE_NAME)}" />
  <meta property="og:type"        content="${esc(type)}" />
  <meta property="og:title"       content="${fullTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:url"         content="${safeUrl}" />
  <meta property="og:image"       content="${safeImage}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
${articleMeta}
  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${fullTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image"       content="${safeImage}" />

  <!-- Instant redirect for human visitors -->
  <meta http-equiv="refresh" content="0;url=${esc(redirectUrl)}" />
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</head>
<body>
  <p>Redirecting… <a href="${esc(redirectUrl)}">click here if not redirected</a></p>
</body>
</html>
`;
}

function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
}

// ── Posts ─────────────────────────────────────────────────────────────────────
function buildPosts() {
    const files = fs.readdirSync(BLOGS_DIR).filter(f => f.endsWith(".json") && f !== "series.json");
    let count = 0;

    for (const file of files) {
        let post;
        try {
            post = JSON.parse(fs.readFileSync(path.join(BLOGS_DIR, file), "utf8"));
        } catch (e) {
            console.warn(`  ⚠  Could not parse ${file}: ${e.message}`);
            continue;
        }

        const slug = post.slug ?? path.basename(file, ".json");
        const canonUrl = `${BASE_URL}/post/${slug}/`;          // pretty URL
        const redirectUrl = `${BASE_URL}/post.html?slug=${encodeURIComponent(slug)}`;
        const image = resolveImage(post["og-image"]);
        const tags = Array.isArray(post.tag) ? post.tag : post.tag ? [post.tag] : [];

        const html = shell({
            title: post.title ?? slug,
            description: post.description ?? post.excerpt ?? "",
            url: canonUrl,
            image,
            type: "article",
            article: {
                publishedTime: post.date ?? "",
                modifiedTime: post.updated ?? post.date ?? "",
                author: SITE_NAME,
                tags,
            },
            redirectUrl,
        });

        const outPath = path.join(OUTPUT_ROOT, "post", slug, "index.html");
        writeFile(outPath, html);
        console.log(`  ✓  post/${slug}/index.html  [og:image → ${image}]`);
        count++;
    }
    return count;
}

// ── Series ────────────────────────────────────────────────────────────────────
function buildSeries() {
    const seriesFile = path.join(BLOGS_DIR, "series.json");
    if (!fs.existsSync(seriesFile)) {
        console.log("  (no series.json found — skipping series build)");
        return 0;
    }

    let allSeries;
    try {
        allSeries = JSON.parse(fs.readFileSync(seriesFile, "utf8"));
    } catch (e) {
        console.warn(`  ⚠  Could not parse series.json: ${e.message}`);
        return 0;
    }

    let count = 0;
    for (const series of allSeries) {
        const id = series.id;
        const canonUrl = `${BASE_URL}/series/${encodeURIComponent(id)}/`;
        const redirectUrl = `${BASE_URL}/series.html?id=${encodeURIComponent(id)}`;
        const image = resolveImage(series["og-image"]);

        const html = shell({
            title: series.title ?? id,
            description: series.description ?? "",
            url: canonUrl,
            image,
            type: "website",
            redirectUrl,
        });

        const outPath = path.join(OUTPUT_ROOT, "series", id, "index.html");
        writeFile(outPath, html);
        console.log(`  ✓  series/${id}/index.html  [og:image → ${image}]`);
        count++;
    }
    return count;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("\n🔨  build-og.js — pre-rendering OG shells\n");
console.log("Posts:");
const postCount = buildPosts();
console.log("\nSeries:");
const seriesCount = buildSeries();
console.log(`\n✅  Done — ${postCount} post(s), ${seriesCount} series generated into ./dist/\n`);