const fs = require("fs");

const OUT_DIR = "./share";
const BASE_URL = "https://kingrogkdr.github.io";

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR);
}

const posts = fs.readdirSync("./blogs")
    .filter(f => f.endsWith(".json") && f !== "series.json");

const seriesList = JSON.parse(
    fs.readFileSync("./blogs/series.json", "utf-8")
);

posts.forEach(file => {
    const post = JSON.parse(fs.readFileSync(`./blogs/${file}`, "utf-8"));
    const slug = file.replace(".json", "");

    const html = buildHTML({
        title: post.title,
        description: post.description || post.excerpt || "",
        image: resolveImage(post["og-image"]),
        url: `${BASE_URL}/post.html?slug=${slug}`,
        type: "article"
    });

    fs.writeFileSync(`./share/${slug}.html`, html);
});

seriesList.forEach(series => {
    const html = buildHTML({
        title: series.title,
        description: series.description || "",
        image: resolveImage(series["og-image"]),
        url: `${BASE_URL}/series.html?id=${series.id}`,
        type: "website"
    });

    fs.writeFileSync(`./share/series-${series.id}.html`, html);
});

function buildHTML({ title, description, image, url, type }) {
    return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />

  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}" />

  <meta property="og:title" content="${escape(title)}" />
  <meta property="og:description" content="${escape(description)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="${type}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escape(title)}" />
  <meta name="twitter:description" content="${escape(description)}" />
  <meta name="twitter:image" content="${image}" />

  <meta http-equiv="refresh" content="0; url=${url}" />
</head>
<body></body>
</html>`;
}

function escape(str = "") {
    return str
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function resolveImage(img) {
    if (!img) {
        return `${BASE_URL}/images/og-default.png`;
    }

    if (img.startsWith("http")) {
        return img;
    }

    return `${BASE_URL}/${img}`;
}
console.log("Share pages generated.");