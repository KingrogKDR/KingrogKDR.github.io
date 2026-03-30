/**
 * seo.js — Shared SEO & meta-tag injection for kingrogkdr.github.io
 *
 * Usage:
 *   Call window.SEO.setPage({ title, description, url, type, image, article })
 *   from each page's init() after you have the relevant data.
 *
 * This module injects / updates:
 *   - <title>
 *   - meta description
 *   - canonical <link>
 *   - Open Graph tags (og:title, og:description, og:url, og:type, og:image, og:site_name)
 *   - Twitter Card tags
 *   - JSON-LD structured data (WebSite, Person, BlogPosting, BreadcrumbList)
 */

(function () {
    "use strict";

    const SITE_NAME = "Abhishek Saikia";
    const BASE_URL = "https://kingrogkdr.github.io"; // ← change to your domain
    const DEFAULT_IMAGE = `${BASE_URL}/images/og-default.png`; // create a 1200×630 OG image
    const TWITTER_HANDLE = "@king_rog234"; // ← update or set to "" to omit

    /** Create or update a <meta> tag by property or name attribute */
    function setMeta(attr, key, content) {
        if (!content) return;
        let el = document.querySelector(`meta[${attr}="${key}"]`);
        if (!el) {
            el = document.createElement("meta");
            el.setAttribute(attr, key);
            document.head.appendChild(el);
        }
        el.setAttribute("content", content);
    }

    /** Create or update <link rel="canonical"> */
    function setCanonical(url) {
        if (!url) return;
        let el = document.querySelector('link[rel="canonical"]');
        if (!el) {
            el = document.createElement("link");
            el.setAttribute("rel", "canonical");
            document.head.appendChild(el);
        }
        el.setAttribute("href", url);
    }

    /** Inject or replace a <script type="application/ld+json"> block */
    function setJsonLd(data) {
        let el = document.querySelector('script[type="application/ld+json"]');
        if (!el) {
            el = document.createElement("script");
            el.setAttribute("type", "application/ld+json");
            document.head.appendChild(el);
        }
        el.textContent = JSON.stringify(data, null, 2);
    }

    /**
     * Main entry point.
     *
     * @param {object} opts
     * @param {string} opts.title        - Page / post title (plain text, no site suffix)
     * @param {string} opts.description  - Meta description (≤160 chars recommended)
     * @param {string} [opts.url]        - Canonical URL (defaults to current href)
     * @param {string} [opts.type]       - og:type, e.g. "article" | "website" (default "website")
     * @param {string} [opts.image]      - Absolute URL for OG image
     * @param {object} [opts.article]    - Article-specific data
     * @param {string} [opts.article.publishedTime]  - ISO date
     * @param {string} [opts.article.modifiedTime]   - ISO date
     * @param {string[]} [opts.article.tags]         - Array of tag strings
     * @param {string} [opts.article.author]         - Author name
     * @param {string} [opts.article.seriesName]     - Name of series (if applicable)
     * @param {object[]} [opts.breadcrumbs]          - [{name, url}, ...]
     */
    function setPage(opts) {
        const {
            title,
            description,
            url = window.location.href,
            type = "website",
            image = DEFAULT_IMAGE,
            article,
            breadcrumbs,
        } = opts;

        const fullTitle = title
            ? `${title} — ${SITE_NAME}`
            : SITE_NAME;

        // ── <title> ──
        document.title = fullTitle;

        // ── Meta description ──
        setMeta("name", "description", description);

        // ── Canonical ──
        setCanonical(url);

        // ── Open Graph ──
        setMeta("property", "og:site_name", SITE_NAME);
        setMeta("property", "og:type", type);
        setMeta("property", "og:title", fullTitle);
        setMeta("property", "og:description", description);
        setMeta("property", "og:url", url);
        setMeta("property", "og:image", image);
        setMeta("property", "og:image:width", "1200");
        setMeta("property", "og:image:height", "630");

        if (article) {
            if (article.publishedTime)
                setMeta("property", "article:published_time", article.publishedTime);
            if (article.modifiedTime)
                setMeta("property", "article:modified_time", article.modifiedTime);
            if (article.author)
                setMeta("property", "article:author", article.author);
            if (article.tags) {
                // Remove existing article:tag metas first
                document
                    .querySelectorAll('meta[property="article:tag"]')
                    .forEach((el) => el.remove());
                article.tags.forEach((tag) => {
                    const el = document.createElement("meta");
                    el.setAttribute("property", "article:tag");
                    el.setAttribute("content", tag);
                    document.head.appendChild(el);
                });
            }
        }

        // ── Twitter Card ──
        setMeta("name", "twitter:card", "summary_large_image");
        setMeta("name", "twitter:title", fullTitle);
        setMeta("name", "twitter:description", description);
        setMeta("name", "twitter:image", image);
        if (TWITTER_HANDLE) setMeta("name", "twitter:site", TWITTER_HANDLE);

        // ── JSON-LD Structured Data ──
        const graphs = [];

        // Always: WebSite
        graphs.push({
            "@type": "WebSite",
            "@id": `${BASE_URL}/#website`,
            url: BASE_URL,
            name: SITE_NAME,
            description: "Essays, projects, and ideas by Abhishek Saikia.",
            potentialAction: {
                "@type": "SearchAction",
                target: {
                    "@type": "EntryPoint",
                    urlTemplate: `${BASE_URL}/writing.html?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
            },
        });

        // Always: Person (author)
        graphs.push({
            "@type": "Person",
            "@id": `${BASE_URL}/#person`,
            name: SITE_NAME,
            url: BASE_URL,
            sameAs: [],
        });

        // Article pages
        if (type === "article" && article) {
            const articleGraph = {
                "@type": "BlogPosting",
                "@id": url,
                headline: title,
                description: description,
                url: url,
                image: image,
                author: {
                    "@id": `${BASE_URL}/#person`,
                },
                publisher: {
                    "@id": `${BASE_URL}/#website`,
                },
            };
            if (article.publishedTime) articleGraph.datePublished = article.publishedTime;
            if (article.modifiedTime) articleGraph.dateModified = article.modifiedTime;
            if (article.tags) articleGraph.keywords = article.tags.join(", ");
            if (article.seriesName) {
                articleGraph.isPartOf = {
                    "@type": "CreativeWorkSeries",
                    name: article.seriesName,
                };
            }
            graphs.push(articleGraph);
        }

        // Breadcrumbs
        if (breadcrumbs && breadcrumbs.length > 0) {
            graphs.push({
                "@type": "BreadcrumbList",
                itemListElement: breadcrumbs.map((crumb, i) => ({
                    "@type": "ListItem",
                    position: i + 1,
                    name: crumb.name,
                    item: crumb.url,
                })),
            });
        }

        setJsonLd({
            "@context": "https://schema.org",
            "@graph": graphs,
        });
    }

    window.SEO = { setPage, BASE_URL, SITE_NAME };
})();