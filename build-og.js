#!/usr/bin/env node
/**
 * build-og.js — Generate static shareable HTML files for GitHub Pages
 *
 * Generates:
 *   post/{slug}.html    — full post with OG tags, TOC, series banner + prev/next
 *   series/{id}.html    — series index with OG tags
 *
 * Run:  node build-og.js
 * Then commit the generated post/ and series/ folders.
 * Share URLs like: https://kingrogkdr.github.io/post/{slug}.html
 */

const fs = require("fs");
const path = require("path");

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

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

function normaliseTags(raw) {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// ── Render post content + collect headings for TOC ───────────────────────────
function renderInline(text) {
  return text
    .replace(/\{color:([a-zA-Z#0-9,%. ]+)\|(.+?)\}/g, '<span style="color:$1">$2</span>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderContent(items) {
  if (!Array.isArray(items)) return { html: "", headings: [] };
  const headings = [];
  const html = items.map(item => {
    if (typeof item === "string") {
      if (item.startsWith("- ")) {
        const bullets = item
          .split("\n")
          .filter(l => l.startsWith("- "))
          .map(l => `<li>${renderInline(l.slice(2))}</li>`)
          .join("");
        return `<ul class="post-list">${bullets}</ul>`;
      }
      return `<p>${renderInline(item)}</p>`;
    }
    if (item.heading) {
      const id = slugify(item.heading);
      headings.push({ id, text: item.heading });
      return `<h2 id="${id}" class="post-section-heading">${esc(item.heading)}</h2>`;
    }
    if (item.image) {
      const imgSrc = item.image.startsWith("http")
        ? item.image
        : `../${item.image.replace(/^\//, "")}`;
      const caption = item.caption
        ? `<figcaption class="post-image-caption">${esc(item.caption)}</figcaption>`
        : "";
      return `<figure class="post-image">
        <img src="${esc(imgSrc)}" alt="${esc(item.caption || "")}" loading="lazy">
        ${caption}
      </figure>`;
    }
    return "";
  }).join("\n");
  return { html, headings };
}

// ── TOC sidebar ──────────────────────────────────────────────────────────────
function buildTOC(headings) {
  if (headings.length < 2) {
    return `<aside class="toc" id="toc" aria-label="Table of contents">
  <p class="toc-label">Contents</p>
  <p class="toc-empty-msg">No sections in this post.</p>
</aside>`;
  }
  const items = headings.map(h =>
    `<li><a href="#${h.id}">${esc(h.text)}</a></li>`
  ).join("\n    ");
  return `<aside class="toc" id="toc" aria-label="Table of contents">
  <p class="toc-label">Contents</p>
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
      <span class="series-chip">Series</span>
      <a href="../series/${esc(series.id)}.html" class="series-banner-name">${esc(series.title)}</a>
    </div>
    <span class="series-banner-part">Part ${partNum} of ${totalDefined}</span>
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
function buildPostHTML(post, cv, seriesData) {
  const slug = post.slug;
  const tags = normaliseTags(post.tag);
  const parentSeries = seriesData.find(s => s.posts.includes(slug));
  const image = resolveImage(post["og-image"] ?? parentSeries?.["og-image"]);
  const canonUrl = `${BASE_URL}/post/${slug}.html`;
  const description = post.description ?? post.excerpt ?? "";
  const fullTitle = `${post.title} — ${SITE_NAME}`;
  const authorName = cv.name ?? SITE_NAME;

  // Load sibling posts if this post belongs to a series
  let seriesBannerHTML = "";
  let seriesNavHTML = "";
  if (parentSeries) {
    const seriesPosts = parentSeries.posts.map(s => {
      try { return JSON.parse(fs.readFileSync(path.join(BLOGS_DIR, `${s}.json`), "utf8")); }
      catch { return null; }
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

  const { html: contentHTML, headings } = renderContent(post.content);
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

  <script>
    (function () {
      const saved = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (saved === "dark" || (!saved && prefersDark)) {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    })();
  </script>

  <link rel="stylesheet" href="../style.css" />
  <style>
    /* ── Nav mobile ── */
    .menu-toggle {
      display: none; background: none; border: 1px solid var(--faint);
      border-radius: 4px; color: var(--ink); font-size: 18px; line-height: 1;
      width: 36px; height: 36px; cursor: pointer; align-items: center;
      justify-content: center; flex-shrink: 0;
      transition: border-color 0.2s, color 0.2s;
    }
    @media (max-width: 640px) {
      .menu-toggle { display: flex; }
      .nav-inner { padding: 0 20px; gap: 12px; }
      .nav-links {
        display: none; flex-direction: column; gap: 0; position: absolute;
        top: 56px; left: 0; right: 0; background: var(--nav-bg);
        backdrop-filter: blur(10px); border-bottom: 1px solid var(--faint);
        padding: 8px 0 16px; list-style: none;
      }
      .nav-links.open { display: flex; }
      .nav-links li a { display: block; padding: 12px 20px; font-size: 15px; border-bottom: 1px solid var(--faint); }
      .nav-links li:last-child a { border-bottom: none; }
    }

    /* ── TOC ── */
    .toc {
      position: fixed; top: 50%; left: 0; transform: translateY(-50%);
      width: 200px; padding: 0 24px 0 32px; opacity: 1; z-index: 10;
    }
    .toc-label {
      font-size: 10px; font-weight: 500; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--accent); margin-bottom: 16px;
    }
    .toc-list {
      list-style: none; padding: 0; margin: 0; border-left: 1px solid var(--faint);
    }
    .toc-list a {
      display: block; padding: 5px 0 5px 14px; margin-left: -1px;
      color: var(--muted); text-decoration: none; font-size: 12px;
      font-weight: 400; line-height: 1.45; border-left: 2px solid transparent;
      transition: color 0.2s, border-color 0.15s;
    }
    .toc-list a:hover { color: var(--ink); }
    .toc-list a.active { color: var(--ink); border-left-color: var(--accent); font-weight: 500; }
    .toc-empty-msg {
      font-size: 12px; color: var(--muted); font-style: italic;
      line-height: 1.5; padding-left: 14px; border-left: 1px solid var(--faint);
    }
    @media (max-width: 1000px) { .toc { display: none; } }

    /* ── Post page ── */
    .post-page { max-width: 720px; margin: 0 auto; padding: 100px 32px 100px; }
    .post-section-heading {
      font-family: "Lora", serif; font-size: 16px; font-weight: 400;
      letter-spacing: -0.01em; color: var(--ink); opacity: 0.8;
      margin: 52px 0 20px; scroll-margin-top: 80px; line-height: 1.3;
    }
    .post-header-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .post-header-tag-chip {
      display: inline-flex; align-items: center; font-size: 11px; font-weight: 500;
      letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 12px;
      border-radius: 99px; border: 1px solid var(--faint); color: var(--muted);
      background: transparent; line-height: 1;
      transition: border-color 0.2s, color 0.2s; text-decoration: none;
    }
    .post-header-tag-chip:hover { border-color: var(--accent); color: var(--accent); }
    .post-header-meta-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; flex-wrap: wrap;
    }
    .post-header-meta { font-size: 13px; color: var(--muted); margin: 0; }

    .post-body mark {
        background: color-mix(in srgb, var(--accent) 22%, transparent);
        color: inherit;
        border-radius: 2px;
        padding: 0 2px;
    }
    .post-body code {
      font-family: "Fira Code", "Cascadia Code", monospace;
      font-size: 0.85em;
      background: color-mix(in srgb, var(--ink) 8%, transparent);
      border-radius: 4px;
      padding: 2px 6px;
    }
    .post-body u { text-decoration-color: var(--accent); }
    .post-body a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
    .post-list { padding-left: 1.4em; margin: 16px 0; display: flex; flex-direction: column; gap: 6px; }
    .post-list li { font-size: 15px; line-height: 1.7; color: var(--ink); }

    /* ── Share button ── */
    .share-btn {
      display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
      font-weight: 500; letter-spacing: 0.04em; color: var(--muted);
      background: transparent; border: 1px solid var(--faint);
      border-radius: 99px; padding: 5px 13px; cursor: pointer; flex-shrink: 0;
      transition: border-color 0.2s, color 0.2s, background 0.2s;
    }
    .share-btn:hover {
      border-color: var(--accent); color: var(--accent);
      background: color-mix(in srgb, var(--accent) 6%, transparent);
    }
    .share-btn svg { width: 13px; height: 13px; flex-shrink: 0; stroke: currentColor; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

    /* ── Share toast ── */
    [data-theme="dark"] .share-toast { background: #ffffff; color: #000000; }
    [data-theme="light"] .share-toast { background: #000000; color: #ffffff; }
    .share-toast {
      position: fixed; bottom: 28px; left: 50%;
      transform: translateX(-50%) translateY(12px);
      font-size: 13px; font-weight: 450; letter-spacing: 0.01em;
      padding: 10px 18px; border-radius: 99px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.18); opacity: 0;
      pointer-events: none; transition: opacity 0.22s ease, transform 0.22s ease;
      white-space: nowrap; z-index: 9999; display: flex; align-items: center; gap: 7px;
    }
    .share-toast.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
    .share-toast svg { width: 14px; height: 14px; flex-shrink: 0; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    /* ── Series banner ── */
    .series-banner {
      border: 1px solid var(--faint); border-radius: 10px;
      padding: 16px 18px; margin-bottom: 16px;
      background: color-mix(in srgb, var(--accent) 3%, transparent);
    }
    .series-banner-top {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
    }
    .series-banner-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .series-chip {
      font-size: 10px; font-weight: 600; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      padding: 3px 8px; border-radius: 99px;
    }
    .series-banner-name {
      font-size: 13px; font-weight: 500; color: var(--ink);
      text-decoration: none; transition: color 0.15s; letter-spacing: -0.01em;
    }
    .series-banner-name:hover { color: var(--accent); }
    .series-banner-part { font-size: 11.5px; color: var(--muted); }
    .series-banner-parts { display: flex; gap: 8px; flex-wrap: wrap; }
    .series-banner-part-link {
      display: inline-flex; align-items: center; gap: 4px; font-size: 12px;
      color: var(--muted); text-decoration: none; padding: 4px 10px;
      border: 1px solid var(--faint); border-radius: 6px;
      transition: border-color 0.15s, color 0.15s; white-space: nowrap;
    }
    .series-banner-part-link:hover { border-color: var(--accent); color: var(--ink); }
    .series-banner-part-link.current {
      border-color: var(--accent); color: var(--ink);
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      font-weight: 500; pointer-events: none;
    }
    .series-banner-part-link.unavailable { opacity: 0.35; pointer-events: none; font-style: italic; }
    .part-num-label {
      font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
      color: var(--muted); opacity: 0.6; margin-right: 1px;
    }
    .series-banner-part-link.current .part-num-label { opacity: 1; color: var(--accent); }

    /* ── Series nav strip ── */
    .series-nav-strip {
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px; margin-bottom: 32px; padding: 8px 0;
      border-bottom: 1px solid var(--faint);
    }
    .series-nav-link {
      display: inline-flex; align-items: center; gap: 5px; font-size: 12px;
      color: var(--muted); text-decoration: none; padding: 2px 0;
      transition: color 0.15s; max-width: 42%;
    }
    .series-nav-link:hover { color: var(--ink); }
    .series-nav-link.faded { opacity: 0.3; pointer-events: none; }
    .series-nav-link svg { width: 12px; height: 12px; flex-shrink: 0; }
    .series-nav-link-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
    .series-nav-center { font-size: 11px; color: var(--muted); opacity: 0.45; white-space: nowrap; letter-spacing: 0.05em; flex-shrink: 0; }

    @media (max-width: 540px) {
      .post-page { padding: 84px 18px 64px; }
      .series-nav-center { display: none; }
      .series-nav-link { max-width: 48%; }
    }
  </style>
</head>
<body>
  <nav>
    <div class="nav-inner">
      <a href="../index.html" class="nav-logo">${esc(authorName)}</a>
      <div class="nav-right">
        <ul class="nav-links" id="nav-links">
          <li><a href="../writing.html">Writing</a></li>
          <li><a href="../projects.html">Projects</a></li>
          <li><a href="../contact.html">Contact</a></li>
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
      <a href="../writing.html" class="back-link">← All writing</a>
      <article itemscope itemtype="https://schema.org/BlogPosting">
        ${seriesBannerHTML}
        ${seriesNavHTML}
        <div class="post-header fade-in d2">
          ${tagChipsHTML ? `<div class="post-header-tags">${tagChipsHTML}</div>` : ""}
          <h1 class="post-header-title" itemprop="headline">${esc(post.title)}</h1>
          <div class="post-header-meta-row">
            <p class="post-header-meta">
              <time itemprop="datePublished" datetime="${esc(post.date)}">${formatDate(post.date)}</time>
            </p>
            <button class="share-btn" id="share-btn" aria-label="Share this post">
              <svg viewBox="0 0 14 14"><circle cx="11" cy="2.5" r="1.5"/><circle cx="11" cy="11.5" r="1.5"/><circle cx="3" cy="7" r="1.5"/><line x1="4.4" y1="7.7" x2="9.7" y2="10.9"/><line x1="9.7" y1="3.1" x2="4.4" y2="6.3"/></svg>
              Share
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
    <p>© ${new Date().getFullYear()} ${esc(authorName)} · Made with care</p>
  </footer>

  <script>
    // ── TOC active link tracking ──
    (function () {
      const tocList = document.getElementById("toc-list");
      if (!tocList) return;
      const links    = tocList.querySelectorAll("a");
      const headings = document.querySelectorAll("#post-content h2.post-section-heading, .post-body h2.post-section-heading");
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
  const totalParts = series.posts.length;
  const loadedCount = posts.filter(Boolean).length;

  const postsHTML = posts.map((post, i) => {
    const partNum = i + 1;
    if (!post) {
      return `<div style="display:flex;align-items:flex-start;gap:20px;padding:20px 0;opacity:0.4;pointer-events:none;">
        <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;border:1.5px solid var(--faint);background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--muted);position:relative;z-index:1;">${partNum}</div>
        <div style="padding-top:5px;">
          <p style="font-size:10.5px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;">Part ${partNum} of ${totalParts}</p>
          <h2 style="font-size:16px;font-weight:500;color:var(--ink);margin:0;">Coming soon</h2>
        </div>
      </div>`;
    }
    return `<a href="../post/${esc(post.slug)}.html" style="display:flex;align-items:flex-start;gap:20px;padding:20px 0;text-decoration:none;color:inherit;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.78'" onmouseout="this.style.opacity='1'">
      <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;border:1.5px solid var(--faint);background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--muted);position:relative;z-index:1;">${partNum}</div>
      <div style="flex:1;padding-top:5px;">
        <p style="font-size:10.5px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;">Part ${partNum} of ${totalParts}</p>
        <h2 style="font-size:16px;font-weight:500;color:var(--ink);line-height:1.35;margin:0 0 6px;letter-spacing:-0.01em;">${esc(post.title)}</h2>
        <p style="font-size:13.5px;color:var(--muted);line-height:1.65;margin:0 0 8px;">${esc(post.excerpt)}</p>
        <time style="font-size:12px;color:var(--muted);opacity:0.7;" datetime="${post.date}">${formatDate(post.date)}</time>
      </div>
    </a>`;
  }).join('<div style="border-top:1px solid var(--faint);"></div>');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(series.description ?? "")}" />
  <link rel="canonical" href="${esc(canonUrl)}" />

  <!-- Open Graph — baked in at build time -->
  <meta property="og:site_name"    content="${esc(SITE_NAME)}" />
  <meta property="og:type"         content="website" />
  <meta property="og:title"        content="${esc(fullTitle)}" />
  <meta property="og:description"  content="${esc(series.description ?? "")}" />
  <meta property="og:url"          content="${esc(canonUrl)}" />
  <meta property="og:image"        content="${esc(image)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
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
      const saved = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (saved === "dark" || (!saved && prefersDark)) {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    })();
  </script>
  <link rel="stylesheet" href="../style.css" />
  <style>
    .menu-toggle { display:none; background:none; border:1px solid var(--faint); border-radius:4px; color:var(--ink); font-size:18px; line-height:1; width:36px; height:36px; cursor:pointer; align-items:center; justify-content:center; flex-shrink:0; }
    @media (max-width:640px) {
      .menu-toggle { display:flex; }
      .nav-inner { padding: 0 20px; gap: 12px; }
      .nav-links { display:none; flex-direction:column; gap:0; position:absolute; top:56px; left:0; right:0; background:var(--nav-bg); backdrop-filter:blur(10px); border-bottom:1px solid var(--faint); padding:8px 0 16px; list-style:none; }
      .nav-links.open { display:flex; }
      .nav-links li a { display:block; padding:12px 20px; font-size:15px; border-bottom:1px solid var(--faint); }
    }
    .share-btn { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:500; color:var(--muted); background:transparent; border:1px solid var(--faint); border-radius:99px; padding:5px 13px; cursor:pointer; transition:border-color 0.2s, color 0.2s; }
    .share-btn:hover { border-color:var(--accent); color:var(--accent); }
    .share-btn svg { width:13px; height:13px; stroke:currentColor; fill:none; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
    [data-theme="dark"] .share-toast { background:#ffffff; color:#000000; }
    [data-theme="light"] .share-toast { background:#000000; color:#ffffff; }
    .share-toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%) translateY(12px); font-size:13px; padding:10px 18px; border-radius:99px; box-shadow:0 4px 20px rgba(0,0,0,0.18); opacity:0; pointer-events:none; transition:opacity 0.22s ease, transform 0.22s ease; white-space:nowrap; z-index:9999; display:flex; align-items:center; gap:7px; }
    .share-toast.visible { opacity:1; transform:translateX(-50%) translateY(0); }
    .series-posts-wrap { display:flex; flex-direction:column; position:relative; }
    .series-posts-wrap::before { content:""; position:absolute; left:18px; top:28px; bottom:28px; width:1px; background:var(--faint); }
  </style>
</head>
<body>
  <nav>
    <div class="nav-inner">
      <a href="../index.html" class="nav-logo">${esc(authorName)}</a>
      <div class="nav-right">
        <ul class="nav-links" id="nav-links">
          <li><a href="../writing.html">Writing</a></li>
          <li><a href="../projects.html">Projects</a></li>
          <li><a href="../contact.html">Contact</a></li>
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
    <div class="page">
      <a href="../writing.html" class="back-link fade-in d1">← All writing</a>
      <div style="margin-bottom:48px;" class="fade-in d2" itemscope itemtype="https://schema.org/CreativeWorkSeries">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
          <span style="font-size:10.5px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);">Series</span>
          <span style="font-size:11px;font-weight:500;color:var(--muted);background:color-mix(in srgb,var(--ink) 6%,transparent);padding:3px 9px;border-radius:99px;border:1px solid var(--faint);">${loadedCount} of ${totalParts} published</span>
        </div>
        <h1 style="font-size:clamp(26px,5vw,36px);font-weight:600;letter-spacing:-0.02em;line-height:1.15;color:var(--ink);margin:0 0 14px;" itemprop="name">${esc(series.title)}</h1>
        <p style="font-size:15px;color:var(--muted);line-height:1.75;max-width:580px;margin:0 0 18px;" itemprop="description">${esc(series.description ?? "")}</p>
        <button class="share-btn" id="share-btn">
          <svg viewBox="0 0 14 14"><circle cx="11" cy="2.5" r="1.5"/><circle cx="11" cy="11.5" r="1.5"/><circle cx="3" cy="7" r="1.5"/><line x1="4.4" y1="7.7" x2="9.7" y2="10.9"/><line x1="9.7" y1="3.1" x2="4.4" y2="6.3"/></svg>
          Share series
        </button>
      </div>
      <hr style="border:none;border-top:1px solid var(--faint);margin:0 0 36px;" class="fade-in d3">
      <div class="series-posts-wrap fade-in d3">${postsHTML}</div>
      <a href="../writing.html" style="display:inline-block;margin-top:48px;font-size:13px;color:var(--muted);text-decoration:none;" class="fade-in d4">← Back to all writing</a>
    </div>
  </main>

  <footer>
    <p>© ${new Date().getFullYear()} ${esc(authorName)} · Made with care</p>
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

  // Preload series.json once — used for og-image fallback + banner/nav in posts
  let seriesData = [];
  const seriesJsonPath = path.join(BLOGS_DIR, "series.json");
  if (fs.existsSync(seriesJsonPath)) {
    try { seriesData = JSON.parse(fs.readFileSync(seriesJsonPath, "utf8")); }
    catch (e) { console.warn("  ⚠  Could not parse series.json:", e.message); }
  }

  // ── Posts ──
  const postOutDir = path.join(ROOT_DIR, "post");
  fs.mkdirSync(postOutDir, { recursive: true });

  const files = fs.readdirSync(BLOGS_DIR)
    .filter(f => f.endsWith(".json") && f !== "series.json");
  let postCount = 0;

  for (const file of files) {
    let post;
    try { post = JSON.parse(fs.readFileSync(path.join(BLOGS_DIR, file), "utf8")); }
    catch (e) { console.warn(`  ⚠  Skipping ${file}: ${e.message}`); continue; }

    const slug = post.slug ?? path.basename(file, ".json");
    const image = resolveImage(post["og-image"] ?? seriesData.find(s => s.posts.includes(slug))?.["og-image"]);
    const outPath = path.join(postOutDir, `${slug}.html`);
    fs.writeFileSync(outPath, buildPostHTML(post, cv, seriesData), "utf8");
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
        try { return JSON.parse(fs.readFileSync(path.join(BLOGS_DIR, `${slug}.json`), "utf8")); }
        catch { return null; }
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