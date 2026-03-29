document.addEventListener("DOMContentLoaded", () => {
    // ── THEME TOGGLE ──
    const themeBtn = document.getElementById("theme-toggle");

    const saved = localStorage.getItem("theme");
    if (saved) {
        document.documentElement.setAttribute("data-theme", saved);
    } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
            document.documentElement.setAttribute("data-theme", "dark");
        }
    }

    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme");
            const next = current === "dark" ? "light" : "dark";
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
            // Swap icon between ☰ and ✕
            menuBtn.textContent = isOpen ? "✕" : "☰";
        });

        // Close menu when a nav link is clicked
        navLinks.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                navLinks.classList.remove("open");
                menuBtn.setAttribute("aria-expanded", "false");
                menuBtn.textContent = "☰";
            });
        });

        // Close menu when clicking outside
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
});