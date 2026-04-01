# Blog Content Guide

A reference for writing and publishing posts on the site.

---

## Table of Contents

- [Creating a New Post](#creating-a-new-post)
- [Creating a Series Post](#creating-a-series-post)
- [Post JSON Structure](#post-json-structure)
- [Post Content Formatting](#post-content-formatting)
- [Bio Formatting (cv.json)](#bio-formatting-cvjson)
- [OG Images (Share Cards)](#og-images-share-cards)
- [After Publishing](#after-publishing)

---

## Creating a New Post

### Step 1 — Write the post JSON

Create a new file in `blogs/` named `{slug}.json`:

```json
{
  "title": "Your Post Title",
  "slug": "your-post-title",
  "date": "date",
  "tag": ["Tag One", "Tag Two"],
  "excerpt": "A one or two sentence summary shown in listings and share cards.",
  "pinned": false,
  "og-image": "images/og/your-post-title.jpg",
  "content": [
    { "heading": "First Section" },
    "Your paragraph text here.",
    "Another paragraph."
  ]
}
```

> Set `"pinned": true` to feature it on the homepage.

### Step 2 — Add the OG image

Place a `1200×630px` image at the path you set in `"og-image"`.
If you skip this, it falls back to `images/og-default.png`.

### Step 3 — Add the slug to `index.html`

In `index.html`, find the `BLOGS` array and add your slug:

```js
const BLOGS = [
  "your-post-title", // ← add here
];
```

### Step 4 — Build the static share page

```bash
node build-og.js
```

This generates `post/your-post-title.html` — the URL you share on social media.

### Step 5 — Commit and push

```bash
git add blogs/your-post-title.json post/your-post-title.html images/og/your-post-title.jpg
git commit -m "post: add your-post-title"
git push
```

### Step 6 — Share the correct URL

```
https://DOMAIN-NAME/post/your-post-title.html
```

> ⚠️ Do **not** share `post.html?slug=...` — that URL has no OG tags and will show a blank card on Twitter/WhatsApp.

---

## Creating a Series Post

### Step 1 — Add or update the series in `blogs/series.json`

```json
[
  {
    "id": "your-series-id",
    "title": "Your Series Title",
    "description": "What this series is about.",
    "og-image": "images/og/your-series.jpg",
    "posts": ["first-post-slug", "second-post-slug"]
  }
]
```

Posts are listed in order. If a slug's JSON doesn't exist yet, it shows as **Coming soon** automatically.

### Step 2 — Write the post JSON

Same as a standalone post, but add the `"series"` field matching the series `id`:

```json
{
  "title": "Your Series Post Title",
  "slug": "first-post-slug",
  "date": "2026-04-01",
  "tag": ["Kubernetes", "Systems"],
  "excerpt": "What this part covers.",
  "series": "your-series-id",
  "og-image": "images/og/first-post.jpg",
  "content": [...]
}
```

> If a post has no `"og-image"`, it automatically falls back to the series `"og-image"`, then to `images/og-default.png`.

### Step 3 — Build static pages

```bash
node build-og.js
```

This generates both:

- `post/first-post-slug.html` — the post page (with series banner + prev/next)
- `series/your-series-id.html` — the series index page

### Step 4 — Commit and push

```bash
git add blogs/ post/ series/ images/
git commit -m "post: add first-post-slug (series: your-series-id)"
git push
```

### Step 5 — Share URLs

```
Post:   https://DOMAIN-NAME/post/first-post-slug.html
Series: https://DOMAIN-NAME/series/your-series-id.html
```

---

## Post JSON Structure

| Field         | Type            | Required | Description                                     |
| ------------- | --------------- | -------- | ----------------------------------------------- |
| `title`       | string          | ✅       | Post title                                      |
| `slug`        | string          | ✅       | URL-safe identifier, must match filename        |
| `date`        | string          | ✅       | ISO date: `"2026-04-01"`                        |
| `tag`         | string or array | ✅       | One tag or array of tags                        |
| `excerpt`     | string          | ✅       | Short summary (used in listings + share cards)  |
| `content`     | array           | ✅       | Array of content blocks (see below)             |
| `series`      | string          | —        | Series `id` if this post belongs to one         |
| `og-image`    | string          | —        | Path to share card image (1200×630px)           |
| `pinned`      | boolean         | —        | `true` to show on homepage                      |
| `updated`     | string          | —        | ISO date of last edit (used in OG meta)         |
| `description` | string          | —        | Overrides `excerpt` for meta description if set |

---

## Post Content Formatting

The `"content"` field is an array of blocks. Each block is either a **string** (paragraph), a **heading object**, an **image object**, or a **bullet list string**.

### Content block types

```json
"content": [
  { "heading": "Section Title" },
  "A regular paragraph.",
  { "image": "images/folder/photo.jpg", "caption": "Optional caption." },
  "- First bullet\n- Second bullet\n- Third bullet"
]
```

---

### Inline formatting (inside paragraph strings)

| Style        | Syntax              | Output                            |
| ------------ | ------------------- | --------------------------------- |
| **Bold**     | `**text**`          | **text**                          |
| _Italic_     | `*text*`            | _text_                            |
| Highlight    | `==text==`          | highlighted in accent color       |
| Underline    | `++text++`          | underlined text                   |
| Inline code  | `` `code` ``        | `monospace code block`            |
| Link         | `[label](url)`      | clickable link (opens in new tab) |
| Colored text | `{color:red\|text}` | text in that color                |

---

### Colored text

Use any valid CSS color value:

```
{color:red|danger}
{color:#f59e0b|amber warning}
{color:rgb(99,102,241)|indigo accent}
```

---

### Bullet lists

Write bullet items separated by `\n` in a single string, each line starting with `- `:

```json
"- First item\n- Second item\n- Third item"
```

Inline formatting works inside bullets:

```json
"- Use **kubectl** to manage resources\n- Learn `helm` for package management\n- Read the [official docs](https://kubernetes.io)"
```

### Numbered list

```json
"1. First step\n2. Second step\n3. Third step"
```

### Note blocks

```json
{ "note": "Your note text here." }
{ "note": "Be careful with this.", "type": "warning" }
{ "note": "Pro tip: use labels for better filtering.", "type": "tip" }
```

| Type           | Icon | Color  |
| -------------- | ---- | ------ |
| info (default) | `*`  | Accent |
| warning        | ⚠️   | Amber  |
| tip            | 💡   | Green  |

### Code blocks

```json
{
  "code": "func main() {\n    fmt.Println(\"hello\")\n}",
  "language": "go",
  "caption": "Optional caption below the block."
}
```

Supported languages: `go`, `typescript`, `javascript`, `python`, `rust`, `c`, `bash`, `yaml`, `json`, `sql`, `html`, `css`, and [100+ more](https://highlightjs.org/demo).

Write newlines as `\n` inside the `"code"` string. Indentation with spaces works normally.

---

### Full example post content

```json
"content": [
  { "heading": "What is a Scheduler" },
  "A scheduler is a component that **decides** where your Pods run.",
  "It uses two types of rules: ==hard rules== and *soft preferences*.",
  {
    "image": "images/kubeScheduler/kubeScheduler.svg",
    "caption": "How the Kubernetes scheduler works."
  },
  { "heading": "The Two Steps" },
  "- **Filter**: remove nodes that fail hard rules\n- **Sort**: rank remaining nodes by preference\n- **Assign**: bind the Pod to the winner",
  { "heading": "Why Go Custom" },
  "The default scheduler covers ~90% of cases. For the rest — GPU affinity, region pinning, custom SLAs — you need {color:#f59e0b|your own logic}.",
  "Read the [official scheduler docs](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/) to go deeper."
]
```

---

## Bio Formatting (cv.json)

`bio_long` strings support **raw HTML** — write tags directly:

```json
"bio_long": [
  "I'm <strong>Abhishek Saikia</strong>, a programmer and thinker based in <mark>India</mark>.",
  "I work in <strong>backend and systems engineering</strong> — distributed systems, cloud, and computer internals. Comfortable in <strong>Go</strong>, <strong>TypeScript</strong>, <strong>Python</strong>, and a bit of <u>Rust</u> and <u>C</u>.",
  "I write here irregularly but with intention.",
  "If something I've written resonated with you, <a href='contact.html'>I'd genuinely love to hear about it</a>."
]
```

Supported HTML you can use freely:

| Tag                                   | Effect       |
| ------------------------------------- | ------------ |
| `<strong>text</strong>`               | Bold         |
| `<em>text</em>`                       | Italic       |
| `<u>text</u>`                         | Underline    |
| `<mark>text</mark>`                   | Highlight    |
| `<code>text</code>`                   | Inline code  |
| `<a href="...">text</a>`              | Link         |
| `<span style="color:red">text</span>` | Colored text |
| `<br>`                                | Line break   |

---

## OG Images (Share Cards)

| Situation                                        | Image used              |
| ------------------------------------------------ | ----------------------- |
| Post has `"og-image"`                            | Post's own image        |
| Post has no `"og-image"` but belongs to a series | Series `"og-image"`     |
| Neither post nor series has `"og-image"`         | `images/og-default.png` |

**Specs:** `1200 × 630px`, JPG or PNG.
**Location:** Anywhere under `images/` — recommended paths:

- Standalone posts → `images/og/post-slug.jpg`
- Series → `images/og/series-id.jpg`
- Post inline images → `images/series-id/image-name.jpg`

---

## After Publishing

### Bust social media caches

After pushing, if you shared a URL before and the card looks stale:

| Platform    | Tool                                                                                |
| ----------- | ----------------------------------------------------------------------------------- |
| Twitter / X | [cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator)          |
| Facebook    | [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug/) |
| LinkedIn    | [linkedin.com/post-inspector](https://www.linkedin.com/post-inspector/)             |
| WhatsApp    | Append `?v=2` to the URL — WhatsApp treats it as a new link                         |

### Re-run build after edits

Any time you edit a post JSON or series JSON, re-run the build and push:

```bash
node build-og.js
git add post/ series/
git commit -m "rebuild: update static pages"
git push
```

---

_Last updated: March 2026_
