// nav.js

document.addEventListener("DOMContentLoaded", () => {
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
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a").forEach((link) => {
        const href = link.getAttribute("href");
        if (href === currentPage) link.classList.add("active");
    });
});