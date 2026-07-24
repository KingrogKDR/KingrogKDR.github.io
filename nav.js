// nav.js
//
// Single source of truth for the site navbar. Every page now ships an
// empty `<nav></nav>` placeholder instead of hand-copied markup — this
// file injects the real nav (matching index.html's version: home /
// writing / projects), wires up its behavior, and highlights the active
// tab. Update NAV_LINKS here and every page picks it up automatically.

(function () {
    const NAV_LINKS = [
        { href: "index.html", label: "home" },
        { href: "writing.html", label: "writing" },
        { href: "work.html", label: "work" },
        { href: "projects.html", label: "projects" },
    ];

    const NAV_HTML = `
    <div class="nav-inner">
      <div class="nav-left">
        <span class="window-dots"><span></span><span></span><span></span></span>
        <a href="index.html" class="nav-logo" id="nav-name">abhishek-saikia</a>
      </div>
      <div class="nav-right">
        <ul class="nav-links" id="nav-links">
          ${NAV_LINKS.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join("")}
        </ul>
        <button class="menu-toggle" id="menu-toggle" aria-label="Open menu" aria-expanded="false">☰</button>
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
          <span class="theme-toggle-thumb"></span>
        </button>
      </div>
    </div>`;

    // Inject immediately — this script tag runs after the <nav> element has
    // already been parsed, so it's safe to do this outside DOMContentLoaded.
    const navEl = document.querySelector("nav");
    if (navEl) navEl.innerHTML = NAV_HTML;

    document.addEventListener("DOMContentLoaded", () => {
        // ── NAME (from cv.json) ──
        fetch("cv.json")
            .then((r) => r.json())
            .then((cv) => {
                const nameEl = document.getElementById("nav-name");
                if (nameEl) nameEl.textContent = cv.name.toLowerCase().replace(/\s+/g, "-");
            })
            .catch(() => { });

        // ── THEME TOGGLE ──
        // Dark is the default working theme. The inline script in <head> already
        // set data-theme before paint (to avoid a flash); this just wires the
        // toggle button and persists the choice.
        const themeBtn = document.getElementById("theme-toggle");

        if (themeBtn) {
            themeBtn.addEventListener("click", () => {
                const current = document.documentElement.getAttribute("data-theme");
                const next = current === "light" ? "dark" : "light";
                document.documentElement.setAttribute("data-theme", next);
                localStorage.setItem("theme", next);
            });
        }

        // ── MOBILE MENU TOGGLE ──
        const menuBtn = document.getElementById("menu-toggle");
        const navLinks = document.getElementById("nav-links");

        if (menuBtn && navLinks) {
            menuBtn.addEventListener("click", () => {
                const isOpen = navLinks.classList.toggle("open");
                menuBtn.setAttribute("aria-expanded", isOpen);
                menuBtn.textContent = isOpen ? "✕" : "☰";
            });

            navLinks.querySelectorAll("a").forEach((link) => {
                link.addEventListener("click", () => {
                    navLinks.classList.remove("open");
                    menuBtn.setAttribute("aria-expanded", "false");
                    menuBtn.textContent = "☰";
                });
            });

            document.addEventListener("click", (e) => {
                if (!menuBtn.contains(e.target) && !navLinks.contains(e.target)) {
                    navLinks.classList.remove("open");
                    menuBtn.setAttribute("aria-expanded", "false");
                    menuBtn.textContent = "☰";
                }
            });
        }

        // ── CLOSE MENU ON RESIZE (if viewport becomes desktop-wide) ──
        window.addEventListener("resize", () => {
            if (window.innerWidth > 640 && navLinks) {
                navLinks.classList.remove("open");
                if (menuBtn) {
                    menuBtn.setAttribute("aria-expanded", "false");
                    menuBtn.textContent = "☰";
                }
            }
        });

        // ── MARK ACTIVE NAV TAB ──
        const currentPage =
            window.location.pathname.split("/").pop() || "index.html";
        document.querySelectorAll(".nav-links a").forEach((link) => {
            const href = link.getAttribute("href");
            if (href === currentPage) link.classList.add("active");
        });
    });
})();