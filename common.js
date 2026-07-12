// common.js — shared helpers for pages that use the .page/.gutter/.content-col
// shell (index.html, writing.html). post.html uses its own local copies since
// its content model (rich post body) doesn't fit this shape.

function escHTML(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function normaliseTags(raw) {
    return !raw ? [] : Array.isArray(raw) ? raw : [raw];
}

function formatDate(iso) {
    const d = new Date(iso);
    return {
        mon: d.toLocaleString("en", { month: "short" }),
        year: d.getFullYear(),
    };
}

// Paints the fixed left-hand line-number gutter against the *real* block
// heights of the content column, so it stays aligned even after async
// content (cv.json, post JSON) loads and reflows the page. Call again
// any time the content-col's block list changes.
function paintGutter(selector) {
    const gutter = document.getElementById("gutter");
    if (!gutter || window.innerWidth <= 640) return;
    const col = document.querySelector(".content-col");
    if (!col) return;
    const blocks = col.querySelectorAll(
        selector || ".pane, .section-header, .post-item, .series-card",
    );
    gutter.innerHTML = "";
    let n = 1;
    blocks.forEach((el) => {
        const h = el.getBoundingClientRect().height || 28;
        const span = document.createElement("span");
        span.style.height = h + "px";
        span.style.lineHeight = h + "px";
        span.textContent = String(n).padStart(3, "0");
        gutter.appendChild(span);
        n += 1;
    });
}
// Parses a post file of the form:
//
//   { ...json metadata... }
//   ---
//   markdown content here
//
// The separator must be a line containing only "---". Returns
// { meta, body } where meta is the parsed metadata object and body is the
// raw markdown string (unparsed — pages that only need metadata, like the
// homepage and writing index, can skip rendering it).
function parsePostFile(raw) {
    const sep = raw.match(/\r?\n---[ \t]*\r?\n/);
    if (!sep) {
        throw new Error(
            "Post file is missing the '---' line that separates JSON metadata from Markdown content.",
        );
    }
    const headerRaw = raw.slice(0, sep.index).trim();
    const body = raw.slice(sep.index + sep[0].length);
    let meta;
    try {
        meta = JSON.parse(headerRaw);
    } catch (e) {
        throw new Error("Post metadata block is not valid JSON: " + e.message);
    }
    return { meta, body };
}

window.addEventListener("resize", () => paintGutter());