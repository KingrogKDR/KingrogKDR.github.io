#!/usr/bin/env node
/**
 * build-og.js — Generate static shareable HTML files for GitHub Pages
 *
 * Reads the JSON-metadata + Markdown-body post files (blogs/*.md — see
 * example-post.md for the format) and pre-bakes fully static, crawler-
 * readable pages with real OG tags, since GitHub Pages can't run
 * server-side rendering and crawlers don't execute the client-side JS
 * in post.html.
 *
 * Generates:
 *   post/{slug}.html    — full post with OG tags, TOC, series banner + prev/next
 *   series/{id}.html    — series index with OG tags
 *
 * Requires the `marked` package (same Markdown renderer post.html uses
 * client-side, so the static export and the live page render identically):
 *   npm install marked
 *
 * Run:  node build-og.js
 * Then commit the generated post/ and series/ folders.
 * Share URLs like: https://kingrogkdr.github.io/post/{slug}.html
 */

const fs = require("fs");
const path = require("path");

let marked;
try {
  const m = require("marked");
  marked = m.marked || m; // handles both the v4 default export and v5+ named export
} catch (e) {
  console.error("\n✖  Missing dependency: marked");
  console.error("   This script needs it to render the Markdown post bodies.");
  console.error("   Run:  npm install marked\n");
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = "https://kingrogkdr.github.io";
const SITE_NAME = "Abhishek Saikia";
const TWITTER = "@king_rog234";
const DEFAULT_OG = `${BASE_URL}/images/og-default.png`;
const BLOGS_DIR = path.join(__dirname, "blogs");
const ROOT_DIR = __dirname;
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

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function readingTime(markdown) {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

function normaliseTags(raw) {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// Splits a blogs/*.md file into its JSON metadata block and Markdown body.
// Mirrors parsePostFile() in common.js so both the live site and this
// static export agree on the file format.
function parsePostFile(raw) {
  const sep = raw.match(/\r?\n---[ \t]*\r?\n/);
  if (!sep) {
    throw new Error(
      "missing the '---' line separating JSON metadata from Markdown content",
    );
  }
  const headerRaw = raw.slice(0, sep.index).trim();
  const body = raw.slice(sep.index + sep[0].length);
  let meta;
  try {
    meta = JSON.parse(headerRaw);
  } catch (e) {
    throw new Error("metadata block is not valid JSON: " + e.message);
  }
  return { meta, body };
}

// ── Markdown → HTML, then post-process for the site's custom presentation ────
// Mirrors renderMarkdown()/postProcessBody() in post.html's client script,
// just implemented with string/regex passes instead of DOM APIs since this
// runs in plain Node with no browser available.

function renderMarkdown(md) {
  const withMarks = md.replace(/==(.+?)==/g, "<mark>$1</mark>");
  return marked.parse(withMarks);
}

function processHeadings(html) {
  const headings = [];
  const out = html.replace(/<h([1-3])>([\s\S]*?)<\/h\1>/g, (m, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    const id = slugify(text);
    headings.push({ id, text });
    return `<h${level} id="${id}" class="post-section-heading">${inner}</h${level}>`;
  });
  return { html: out, headings };
}

function processCodeBlocks(html) {
  let n = 0;
  return html.replace(
    /<pre><code(?: class="language-([\w-]*)")?>([\s\S]*?)<\/code><\/pre>(\s*<p><em>([\s\S]*?)<\/em><\/p>)?/g,
    (m, lang, code, capBlock, capText) => {
      n += 1;
      const id = `code-${n}`;
      const langLabel = lang || "plaintext";
      const caption = capText ? `<div class="post-code-caption">${capText}</div>` : "";
      return `<div class="post-code-block">
        <div class="post-code-header">
          <span class="post-code-lang">${esc(langLabel)}</span>
          <button class="post-code-copy" onclick="copyCode('${id}', this)">copy</button>
        </div>
        <pre><code id="${id}" class="language-${langLabel}">${code}</code></pre>
        ${caption}
      </div>`;
    },
  );
}

function processImages(html) {
  return html.replace(
    /<p><img ([^>]+)><\/p>(\s*<p><em>([\s\S]*?)<\/em><\/p>)?/g,
    (m, attrs, capBlock, capText) => {
      const caption = capText ? `<figcaption class="post-image-caption">${capText}</figcaption>` : "";
      return `<figure class="post-image"><img ${attrs} loading="lazy">${caption}</figure>`;
    },
  );
}

function processCallouts(html) {
  const typeMap = {
    note: "info", info: "info",
    tip: "tip", success: "tip",
    warning: "warning", caution: "warning", important: "warning", danger: "warning",
  };
  const iconMap = { info: "i", tip: "$", warning: "!" };
  return html.replace(
    /<blockquote>\s*<p>\[!(\w+)\]\s*([^<]*)<\/p>([\s\S]*?)<\/blockquote>/gi,
    (m, rawType, title, rest) => {
      const type = typeMap[rawType.toLowerCase()] || "info";
      const titleHTML = title && title.trim() ? `<p>${title}</p>` : "";
      return `<div class="post-note post-note--${type}"><span class="post-note-icon">${iconMap[type]}</span><div>${titleHTML}${rest}</div></div>`;
    },
  );
}

function renderBody(markdown) {
  let html = renderMarkdown(markdown);
  const withHeadings = processHeadings(html);
  html = processCodeBlocks(withHeadings.html);
  html = processImages(html);
  html = processCallouts(html);
  return { html, headings: withHeadings.headings };
}

// ── TOC sidebar ──────────────────────────────────────────────────────────────
function buildTOC(headings) {
  if (headings.length < 2) {
    return `<aside class="toc" id="toc" aria-label="Table of contents">
  <p class="toc-label">contents</p>
  <p class="toc-empty-msg">No sections in this post.</p>
</aside>`;
  }
  const items = headings.map(h =>
    `<li><a href="#${h.id}">${esc(h.text)}</a></li>`
  ).join("\n    ");
  return `<aside class="toc" id="toc" aria-label="Table of contents">
  <p class="toc-label">contents</p>
  <ul class="toc-list" id="toc-list">
    ${items}
  </ul>
</aside>`;
}

// ── Series banner ─────────────────────────────────────────────────────────────
function buildSeriesBanner(series, seriesPosts, currentSlug) {
  const totalDefined = series.posts.length;
  const currentIdx = series.posts.indexOf(currentSlug);
  const partNum = currentIdx + 1;

  const partsHTML = series.posts.map((slug, i) => {
    const post = seriesPosts[i];
    const isCurrent = slug === currentSlug;
    const label = `<span class="part-num-label">${i + 1}.</span> ${post ? esc(post.title) : "Coming soon"}`;
    if (isCurrent)
      return `<span class="series-banner-part-link current">${label}</span>`;
    if (!post)
      return `<span class="series-banner-part-link unavailable">${label}</span>`;
    return `<a href="../post/${esc(slug)}.html" class="series-banner-part-link">${label}</a>`;
  }).join("");

  return `<div class="series-banner fade-in d1">
  <div class="series-banner-top">
    <div class="series-banner-left">
      <span class="series-chip">series</span>
      <a href="../series/${esc(series.id)}.html" class="series-banner-name">${esc(series.title)}</a>
    </div>
    <span class="series-banner-part">part ${partNum} of ${totalDefined}</span>
  </div>
  <div class="series-banner-parts">${partsHTML}</div>
</div>`;
}

// ── Series prev/next nav strip ────────────────────────────────────────────────
const ARROW_LEFT = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6H4M6 4L4 6l2 2"/></svg>`;
const ARROW_RIGHT = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h4M6 4l2 2-2 2"/></svg>`;

function buildSeriesNavStrip(series, seriesPosts, currentSlug) {
  const currentIdx = series.posts.indexOf(currentSlug);
  const totalDefined = series.posts.length;
  const prevSlug = currentIdx > 0 ? series.posts[currentIdx - 1] : null;
  const nextSlug = currentIdx < totalDefined - 1 ? series.posts[currentIdx + 1] : null;
  const prevPost = prevSlug ? seriesPosts[series.posts.indexOf(prevSlug)] : null;
  const nextPost = nextSlug ? seriesPosts[series.posts.indexOf(nextSlug)] : null;

  const prevLink = prevPost
    ? `<a href="../post/${esc(prevSlug)}.html" class="series-nav-link" title="${esc(prevPost.title)}">${ARROW_LEFT}<span class="series-nav-link-label">${esc(prevPost.title)}</span></a>`
    : `<span class="series-nav-link faded">${ARROW_LEFT}<span class="series-nav-link-label">First part</span></span>`;

  const nextLink = nextPost
    ? `<a href="../post/${esc(nextSlug)}.html" class="series-nav-link" style="justify-content:flex-end;text-align:right" title="${esc(nextPost.title)}"><span class="series-nav-link-label">${esc(nextPost.title)}</span>${ARROW_RIGHT}</a>`
    : nextSlug
      ? `<span class="series-nav-link faded" style="justify-content:flex-end"><span class="series-nav-link-label">Coming soon</span>${ARROW_RIGHT}</span>`
      : `<a href="../series/${esc(series.id)}.html" class="series-nav-link" style="justify-content:flex-end;text-align:right"><span class="series-nav-link-label">View series</span>${ARROW_RIGHT}</a>`;

  return `<div class="series-nav-strip">
  ${prevLink}
  <span class="series-nav-center">${currentIdx + 1} / ${totalDefined}</span>
  ${nextLink}
</div>`;
}

// ── Post page HTML ────────────────────────────────────────────────────────────
function buildPostHTML(post, body, cv, seriesData, slug) {
  const tags = normaliseTags(post.tag);
  const parentSeries = seriesData.find(s => s.posts.includes(slug));
  const image = resolveImage(post["og-image"] ?? parentSeries?.["og-image"]);
  const canonUrl = `${BASE_URL}/post/${slug}.html`;
  const description = post.description ?? post.excerpt ?? "";
  const fullTitle = `${post.title} — ${SITE_NAME}`;
  const authorName = cv.name ?? SITE_NAME;
  const navName = authorName.toLowerCase().replace(/\s+/g, "-");

  let seriesBannerHTML = "";
  let seriesNavHTML = "";
  if (parentSeries) {
    const seriesPosts = parentSeries.posts.map(s => {
      try {
        const raw = fs.readFileSync(path.join(BLOGS_DIR, `${s}.md`), "utf8");
        return parsePostFile(raw).meta;
      } catch { return null; }
    });
    seriesBannerHTML = buildSeriesBanner(parentSeries, seriesPosts, slug);
    seriesNavHTML = buildSeriesNavStrip(parentSeries, seriesPosts, slug);
  }

  const tagChipsHTML = tags.map(t =>
    `<a href="../writing.html?tag=${encodeURIComponent(t.toLowerCase())}" class="post-header-tag-chip" rel="tag">${esc(t)}</a>`
  ).join("");

  const articleTagMeta = tags.map(t =>
    `  <meta property="article:tag" content="${esc(t)}" />`
  ).join("\n");

  const { html: contentHTML, headings } = renderBody(body);
  const tocHTML = buildTOC(headings);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonUrl)}" />

  <!-- Open Graph — baked in at build time so crawlers read them without JS -->
  <meta property="og:site_name"    content="${esc(SITE_NAME)}" />
  <meta property="og:type"         content="article" />
  <meta property="og:title"        content="${esc(fullTitle)}" />
  <meta property="og:description"  content="${esc(description)}" />
  <meta property="og:url"          content="${esc(canonUrl)}" />
  <meta property="og:image"        content="${esc(image)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="article:published_time" content="${esc(post.date ?? "")}" />
  <meta property="article:modified_time"  content="${esc(post.updated ?? post.date ?? "")}" />
  <meta property="article:author"         content="${esc(authorName)}" />
${articleTagMeta}

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(fullTitle)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image"       content="${esc(image)}" />
  <meta name="twitter:site"        content="${esc(TWITTER)}" />

  <!-- Favicons -->
  <link rel="apple-touch-icon" sizes="180x180" href="../images/favicon/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="../images/favicon/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="../images/favicon/favicon-16x16.png" />
  <link rel="manifest" href="../images/favicon/site.webmanifest" />
  <link rel="icon" href="../images/favicon/favicon.ico" />

  <!-- Theme flash prevention: dark is the default working theme -->
  <script>
    (function () {
      var saved = localStorage.getItem("theme");
      document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
    })();
  </script>

  <link rel="stylesheet" href="../style.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
</head>
<body>
  <nav>
    <div class="nav-inner">
      <div class="nav-left">
        <span class="window-dots"><span></span><span></span><span></span></span>
        <a href="../index.html" class="nav-logo">${esc(navName)}</a>
      </div>
      <div class="nav-right">
        <ul class="nav-links" id="nav-links">
          <li><a href="../writing.html">writing</a></li>
          <li><a href="../projects.html">projects</a></li>
          <li><a href="../contact.html">contact</a></li>
        </ul>
        <button class="menu-toggle" id="menu-toggle" aria-label="Open menu" aria-expanded="false">☰</button>
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
          <span class="theme-toggle-thumb"></span>
        </button>
      </div>
    </div>
  </nav>

  ${tocHTML}

  <div class="share-toast" id="share-toast" role="status" aria-live="polite">
    <svg viewBox="0 0 14 14"><polyline points="2 7 5.5 10.5 12 4" /></svg>
    Link copied
  </div>

  <main>
    <div class="post-page">
      <div class="file-tab-bar"><span class="dot">●</span><span>posts/${esc(slug)}.md</span></div>
      <a href="../writing.html" class="back-link">← all writing</a>
      <article itemscope itemtype="https://schema.org/BlogPosting">
        ${seriesBannerHTML}
        ${seriesNavHTML}
        <div class="post-header fade-in d2">
          ${tagChipsHTML ? `<div class="post-header-tags">${tagChipsHTML}</div>` : ""}
          <h1 class="post-header-title" itemprop="headline">${esc(post.title)}</h1>
          <div class="post-header-meta-row">
            <p class="post-header-meta">
              <time itemprop="datePublished" datetime="${esc(post.date)}">${formatDate(post.date)}</time>
              <span class="post-meta-sep">·</span>
              <span class="post-read-time">${readingTime(body)}</span>
            </p>
            <button class="share-btn" id="share-btn" aria-label="Share this post">
              <svg viewBox="0 0 14 14"><circle cx="11" cy="2.5" r="1.5"/><circle cx="11" cy="11.5" r="1.5"/><circle cx="3" cy="7" r="1.5"/><line x1="4.4" y1="7.7" x2="9.7" y2="10.9"/><line x1="9.7" y1="3.1" x2="4.4" y2="6.3"/></svg>
              share
            </button>
          </div>
        </div>
        <hr class="post-header-divider">
        <div class="post-body fade-in d3" itemprop="articleBody">
          ${contentHTML}
        </div>
      </article>
    </div>
  </main>

  <footer>
    <p>${new Date().getFullYear()} ${esc(authorName)} — thanks for visiting</p>
  </footer>

  <script>
    // ── TOC active link tracking ──
    (function () {
      const tocList = document.getElementById("toc-list");
      if (!tocList) return;
      const links    = tocList.querySelectorAll("a");
      const headings = document.querySelectorAll(".post-body .post-section-heading");
      if (!links.length || !headings.length) return;
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            links.forEach(l => l.classList.remove("active"));
            const match = tocList.querySelector('a[href="#' + entry.target.id + '"]');
            if (match) match.classList.add("active");
          }
        });
      }, { rootMargin: "-15% 0px -75% 0px", threshold: 0 });
      headings.forEach(h => observer.observe(h));
    })();

    // ── Share button ──
    const CANON_URL    = ${JSON.stringify(canonUrl)};
    const POST_TITLE   = ${JSON.stringify(post.title)};
    const POST_EXCERPT = ${JSON.stringify(description)};
    let toastTimer = null;
    function showToast(msg) {
      const toast = document.getElementById("share-toast");
      toast.childNodes[2].textContent = " " + msg;
      toast.classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("visible"), 2400);
    }
    document.getElementById("share-btn").addEventListener("click", async () => {
      if (navigator.share) {
        try { await navigator.share({ title: POST_TITLE, text: POST_EXCERPT, url: CANON_URL }); return; }
        catch (e) { if (e.name === "AbortError") return; }
      }
      try {
        await navigator.clipboard.writeText(CANON_URL);
        showToast("Link copied");
      } catch {
        const inp = document.createElement("input");
        inp.value = CANON_URL; document.body.appendChild(inp);
        inp.select(); document.execCommand("copy");
        document.body.removeChild(inp); showToast("Link copied");
      }
    });
    function copyCode(id, btn) {
      const text = document.getElementById(id).innerText;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "copied!";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "copy"; btn.classList.remove("copied"); }, 2000);
      });
    }
    document.addEventListener("DOMContentLoaded", () => {
      document.querySelectorAll(".post-code-block code").forEach(el => {
        hljs.highlightElement(el);
      });
    });
  </script>
  <script src="../nav.js"></script>
</body>
</html>`;
}

// ── Series page HTML ──────────────────────────────────────────────────────────
function buildSeriesHTML(series, posts, cv) {
  const image = resolveImage(series["og-image"]);
  const canonUrl = `${BASE_URL}/series/${series.id}.html`;
  const fullTitle = `${series.title} — ${SITE_NAME}`;
  const authorName = cv.name ?? SITE_NAME;
  const navName = authorName.toLowerCase().replace(/\s+/g, "-");
  const totalParts = series.posts.length;
  const loadedCount = posts.filter(Boolean).length;

  const postsHTML = posts.map((post, i) => {
    const partNum = i + 1;
    if (!post) {
      return `<div style="display:flex;align-items:flex-start;gap:20px;padding:20px 0;opacity:0.4;pointer-events:none;">
        <div style="flex-shrink:0;width:36px;height:36px;border-radius:var(--radius);border:1px solid var(--border);background:var(--panel);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:11px;color:var(--text-dim);position:relative;z-index:1;">${partNum}</div>
        <div style="padding-top:5px;">
          <p style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);margin-bottom:5px;">part ${partNum} of ${totalParts}</p>
          <h2 style="font-size:16px;font-weight:600;color:var(--text);margin:0;">Coming soon</h2>
        </div>
      </div>`;
    }
    return `<a href="../post/${esc(post.slug ?? series.posts[i])}.html" style="display:flex;align-items:flex-start;gap:20px;padding:20px 0;text-decoration:none;color:inherit;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.78'" onmouseout="this.style.opacity='1'">
      <div style="flex-shrink:0;width:36px;height:36px;border-radius:var(--radius);border:1px solid var(--border);background:var(--panel);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:11px;color:var(--text-dim);position:relative;z-index:1;">${partNum}</div>
      <div style="flex:1;padding-top:5px;">
        <p style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);margin-bottom:5px;">part ${partNum} of ${totalParts}</p>
        <h2 style="font-size:16px;font-weight:600;color:var(--text);line-height:1.35;margin:0 0 6px;letter-spacing:-0.01em;">${esc(post.title)}</h2>
        <p style="font-size:13.5px;color:var(--text-dim);line-height:1.65;margin:0 0 8px;">${esc(post.excerpt)}</p>
        <time style="font-family:var(--font-mono);font-size:12px;color:var(--text-dim);opacity:0.8;" datetime="${post.date}">${formatDate(post.date)}</time>
      </div>
    </a>`;
  }).join('<div style="border-top:1px solid var(--border);"></div>');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(series.description ?? "")}" />
  <link rel="canonical" href="${esc(canonUrl)}" />

  <meta property="og:site_name"    content="${esc(SITE_NAME)}" />
  <meta property="og:type"         content="website" />
  <meta property="og:title"        content="${esc(fullTitle)}" />
  <meta property="og:description"  content="${esc(series.description ?? "")}" />
  <meta property="og:url"          content="${esc(canonUrl)}" />
  <meta property="og:image"        content="${esc(image)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(fullTitle)}" />
  <meta name="twitter:description" content="${esc(series.description ?? "")}" />
  <meta name="twitter:image"       content="${esc(image)}" />
  <meta name="twitter:site"        content="${esc(TWITTER)}" />

  <link rel="apple-touch-icon" sizes="180x180" href="../images/favicon/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="../images/favicon/favicon-32x32.png" />
  <link rel="icon" href="../images/favicon/favicon.ico" />

  <script>
    (function () {
      var saved = localStorage.getItem("theme");
      document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
    })();
  </script>
  <link rel="stylesheet" href="../style.css" />
  <style>
    .series-posts-wrap { display:flex; flex-direction:column; position:relative; }
    .series-posts-wrap::before { content:""; position:absolute; left:18px; top:28px; bottom:28px; width:1px; background:var(--border); }
  </style>
</head>
<body>
  <nav>
    <div class="nav-inner">
      <div class="nav-left">
        <span class="window-dots"><span></span><span></span><span></span></span>
        <a href="../index.html" class="nav-logo">${esc(navName)}</a>
      </div>
      <div class="nav-right">
        <ul class="nav-links" id="nav-links">
          <li><a href="../writing.html">writing</a></li>
          <li><a href="../projects.html">projects</a></li>
          <li><a href="../contact.html">contact</a></li>
        </ul>
        <button class="menu-toggle" id="menu-toggle" aria-label="Open menu" aria-expanded="false">☰</button>
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
          <span class="theme-toggle-thumb"></span>
        </button>
      </div>
    </div>
  </nav>

  <div class="share-toast" id="share-toast" role="status" aria-live="polite">
    <svg viewBox="0 0 14 14"><polyline points="2 7 5.5 10.5 12 4" /></svg>
    Link copied
  </div>

  <main>
    <div class="page-wide">
      <a href="../writing.html" class="back-link fade-in d1">← all writing</a>
      <div style="margin-bottom:48px;" class="fade-in d2" itemscope itemtype="https://schema.org/CreativeWorkSeries">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;font-family:var(--font-mono);">
          <span class="series-label-chip">series</span>
          <span style="font-size:11px;color:var(--text-dim);">${loadedCount} of ${totalParts} published</span>
        </div>
        <h1 style="font-family:var(--font-sans);font-size:clamp(26px,5vw,36px);font-weight:600;letter-spacing:-0.02em;line-height:1.15;color:var(--text);margin:0 0 14px;" itemprop="name">${esc(series.title)}</h1>
        <p style="font-size:15px;color:var(--text-dim);line-height:1.75;max-width:580px;margin:0 0 18px;" itemprop="description">${esc(series.description ?? "")}</p>
        <button class="share-btn" id="share-btn">
          <svg viewBox="0 0 14 14"><circle cx="11" cy="2.5" r="1.5"/><circle cx="11" cy="11.5" r="1.5"/><circle cx="3" cy="7" r="1.5"/><line x1="4.4" y1="7.7" x2="9.7" y2="10.9"/><line x1="9.7" y1="3.1" x2="4.4" y2="6.3"/></svg>
          share series
        </button>
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:0 0 36px;" class="fade-in d3">
      <div class="series-posts-wrap fade-in d3">${postsHTML}</div>
      <a href="../writing.html" style="display:inline-block;margin-top:48px;font-family:var(--font-mono);font-size:13px;color:var(--text-dim);" class="fade-in d4">← back to all writing</a>
    </div>
  </main>

  <footer>
    <p>${new Date().getFullYear()} ${esc(authorName)} — thanks for visiting</p>
  </footer>

  <script>
    const CANON_URL    = ${JSON.stringify(canonUrl)};
    const SERIES_TITLE = ${JSON.stringify(series.title)};
    const SERIES_DESC  = ${JSON.stringify(series.description ?? "")};
    let toastTimer = null;
    function showToast(msg) {
      const toast = document.getElementById("share-toast");
      toast.childNodes[2].textContent = " " + msg;
      toast.classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("visible"), 2400);
    }
    document.getElementById("share-btn").addEventListener("click", async () => {
      if (navigator.share) {
        try { await navigator.share({ title: SERIES_TITLE, text: SERIES_DESC, url: CANON_URL }); return; }
        catch (e) { if (e.name === "AbortError") return; }
      }
      try {
        await navigator.clipboard.writeText(CANON_URL);
        showToast("Link copied");
      } catch {
        const inp = document.createElement("input");
        inp.value = CANON_URL; document.body.appendChild(inp);
        inp.select(); document.execCommand("copy");
        document.body.removeChild(inp); showToast("Link copied");
      }
    });
  </script>
  <script src="../nav.js"></script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log("\n🔨  build-og.js — generating static pages for GitHub Pages\n");

  let cv = {};
  const cvPath = path.join(ROOT_DIR, "cv.json");
  if (fs.existsSync(cvPath)) {
    try { cv = JSON.parse(fs.readFileSync(cvPath, "utf8")); }
    catch (e) { console.warn("  ⚠  Could not parse cv.json:", e.message); }
  }

  let seriesData = [];
  const seriesJsonPath = path.join(BLOGS_DIR, "series.json");
  if (fs.existsSync(seriesJsonPath)) {
    try { seriesData = JSON.parse(fs.readFileSync(seriesJsonPath, "utf8")); }
    catch (e) { console.warn("  ⚠  Could not parse series.json:", e.message); }
  }

  // ── Posts ──
  const postOutDir = path.join(ROOT_DIR, "post");
  fs.mkdirSync(postOutDir, { recursive: true });

  const files = fs.readdirSync(BLOGS_DIR).filter(f => f.endsWith(".md"));
  let postCount = 0;

  for (const file of files) {
    const slug = path.basename(file, ".md");
    let meta, body;
    try {
      const raw = fs.readFileSync(path.join(BLOGS_DIR, file), "utf8");
      ({ meta, body } = parsePostFile(raw));
    } catch (e) {
      console.warn(`  ⚠  Skipping ${file}: ${e.message}`);
      continue;
    }

    const image = resolveImage(meta["og-image"] ?? seriesData.find(s => s.posts.includes(slug))?.["og-image"]);
    const outPath = path.join(postOutDir, `${slug}.html`);
    fs.writeFileSync(outPath, buildPostHTML(meta, body, cv, seriesData, slug), "utf8");
    console.log(`  ✓  post/${slug}.html  [og:image → ${image}]`);
    postCount++;
  }

  // ── Series ──
  let seriesCount = 0;
  if (seriesData.length > 0) {
    const seriesOutDir = path.join(ROOT_DIR, "series");
    fs.mkdirSync(seriesOutDir, { recursive: true });

    for (const series of seriesData) {
      const posts = series.posts.map(slug => {
        try {
          const raw = fs.readFileSync(path.join(BLOGS_DIR, `${slug}.md`), "utf8");
          return { slug, ...parsePostFile(raw).meta };
        } catch { return null; }
      });
      const image = resolveImage(series["og-image"]);
      const outPath = path.join(ROOT_DIR, "series", `${series.id}.html`);
      fs.writeFileSync(outPath, buildSeriesHTML(series, posts, cv), "utf8");
      console.log(`  ✓  series/${series.id}.html  [og:image → ${image}]`);
      seriesCount++;
    }
  } else {
    console.log("  (no series.json — skipping series build)");
  }

  console.log(`\n✅  Done — ${postCount} post(s), ${seriesCount} series\n`);
  console.log("📋  SHARE THESE URLS:");
  console.log(`    Posts:   ${BASE_URL}/post/{slug}.html`);
  console.log(`    Series:  ${BASE_URL}/series/{id}.html\n`);
  console.log("📁  Commit the generated  post/  and  series/  folders.");
  console.log("🔁  Re-run after every new post or edit.\n");
}

main();