{
"title": "On Slowness as a Creative Practice",
"date": "2026-03-14",
"tag": ["craft", "slowness"],
"excerpt": "Why building things slowly is a feature, not a bug — and how I've tried to protect that pace.",
"pinned": true,
"series": "athens-proxy-notes",
"description": "An essay on slowness, attention, and building things with intention.",
"og-image": "images/og/on-slowness.jpg"
}

---

# On slowness as a creative practice

Most advice about creative work is secretly advice about speed. This is an attempt to argue the opposite case.

## Why speed became the default

Paste this straight from Notion or Obsidian — headings, bold, italics, links, and lists all work exactly like you'd expect.

- **Bold** and _italic_ and `inline code` all just work
- So do [links](https://example.com)
- And ==highlighted text==, using Obsidian's own `==mark==` syntax

## A code example

```js
function slow(fn, delayMs) {
  return (...args) => setTimeout(() => fn(...args), delayMs);
}
```

_A tiny wrapper I use more often than I'd like to admit._

## A callout

> [!tip] Obsidian callouts work too
> Just paste a `> [!note]`, `> [!tip]`, or `> [!warning]` block and it renders as a styled note automatically.

## An image with a caption

![A slow morning](images/posts/slow-morning.jpg)
_Some mornings are better left unoptimised._

That's it — no JSON content arrays, no manual heading objects. Just Markdown.
