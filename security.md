# SEO & Security Changes — Abhishek Saikia Personal Site

### Files

- `sitemap.xml` — tells search engines about all your pages
- `robots.txt` — controls crawler access
- `_headers` — Netlify security headers
- `vercel.json` — Vercel security headers

---

## SEO Improvements

### Every page now has:

| Element                                                                         | What it does                                  |
| ------------------------------------------------------------------------------- | --------------------------------------------- |
| `<title>`                                                                       | Descriptive, unique per page                  |
| `<meta name="description">`                                                     | Page summary for search results               |
| `<link rel="canonical">`                                                        | Prevents duplicate content issues             |
| Open Graph tags                                                                 | Rich previews on Facebook, LinkedIn, iMessage |
| Twitter Card tags                                                               | Rich previews on X/Twitter                    |
| `<meta name="author">`                                                          | Author attribution                            |
| JSON-LD structured data                                                         | Helps Google understand your content          |
| Semantic HTML (`<main>`, `<article>`, `<header>`, `<aside>`, `<nav>`, `<time>`) | Better crawler parsing                        |
| `aria-label`, `aria-current`, `role` attributes                                 | Accessibility + SEO                           |

### Post pages specifically get:

- **Article JSON-LD** with headline, description, datePublished, author, keywords, URL
- `<time datetime="...">` on publish dates
- `itemprop` microdata on post content
- `rel="tag"` on tag chip links
- `rel="prev"` / `rel="next"` on series navigation links
- Keywords meta tag from post tags

### sitemap.xml

Add every new blog post slug here manually. Template:

```xml
<url>
  <loc>https://DOMAIN_NAME/post.html?slug=YOUR-SLUG</loc>
  <lastmod>YYYY-MM-DD</lastmod>
  <changefreq>yearly</changefreq>
  <priority>0.8</priority>
</url>
```

---

## Security

### What's protected and how

**This is a static site** — no server, no database, no auth. Attackers cannot "edit your blogs" because:

- There's no write endpoint. The site only reads `.json` files via `fetch()`.
- All editing happens on your local machine / git repository.

The security headers add these protections:

| Header                            | Protects against                           |
| --------------------------------- | ------------------------------------------ |
| `X-Frame-Options: DENY`           | Clickjacking (your site in an iframe)      |
| `X-Content-Type-Options: nosniff` | MIME-type confusion attacks                |
| `X-XSS-Protection`                | XSS in older browsers                      |
| `Content-Security-Policy`         | Inline script injection, data exfiltration |
| `Strict-Transport-Security`       | Downgrade attacks (forces HTTPS)           |
| `Referrer-Policy`                 | Leaking your URLs to third parties         |
| `Permissions-Policy`              | Camera/mic/geo access by injected scripts  |

### Deploy the headers

- **Netlify**: Put `_headers` in your project root. That's it.
- **Vercel**: Put `vercel.json` in your project root. That's it.
- **GitHub Pages**: Use a GitHub Action to inject headers via a proxy (Cloudflare recommended).
- **Cloudflare Pages**: Use the dashboard → Headers rules, or a `_headers` file.

### Protecting your `blogs/` folder from direct browser edits

Since files are served statically, nobody can POST or PUT to them — they're read-only by design.
To prevent people from browsing `https://yoursite.com/blogs/` as a directory listing, add this to `_headers`:

```
/blogs/
  X-Robots-Tag: noindex
```

And on Netlify, add a `[[redirects]]` in `netlify.toml`:

```toml
[[redirects]]
  from = "/blogs/*"
  to = "/404.html"
  status = 404
  conditions = {Type = ["!application/json"]}
```

This blocks HTML browsing of the `/blogs/` folder while still allowing `fetch()` calls to `.json` files.

### Git repository security (most important)

Your actual content lives in git. Protect it:

1. **Never commit secrets** (API keys, passwords) to the repo
2. **Enable branch protection** on `main` — require PRs or at minimum push protection
3. **Use 2FA** on your GitHub/GitLab account
4. If using Netlify/Vercel: only grant deploy access from your main branch

---

## Adding a New Blog Post — Checklist

1. Create `blogs/your-slug.json` with the standard schema
2. Add `"your-slug"` to the `BLOGS` array in `writing.html` (and `index.html` if pinned)
3. Add `<url>` entry to `sitemap.xml`
4. If it's part of a series, add the slug to `blogs/series.json` under the right series `posts` array. Also add `"series":"<series-name>"` to the blog.json file
5. Deploy

That's it — the site picks up everything automatically from the JSON.
