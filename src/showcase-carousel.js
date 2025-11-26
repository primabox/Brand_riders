document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.showcase-carousel');
    if (!container) return;

    const slides = Array.from(container.querySelectorAll('.slide'));
    // prev/next buttons live in the text column; search container-wide
    const prev = container.querySelector('.showcase-prev');
    const next = container.querySelector('.showcase-next');
    let idx = 0;

    const textWrap = container.querySelector('.showcase-text');
    const titleEl = textWrap && textWrap.querySelector('h3');
    const logoImg = textWrap && textWrap.querySelector('.showcase-logo img');
    const descEl = textWrap && textWrap.querySelector('p');

    function updateTextFromSlide(i) {
        const s = slides[i];
        if (!s) return;
        const data = s.dataset || {};
        // try to read inline title/description elements first
        const inlineTitleEl = s.querySelector('.slide-title');
        // read innerHTML so we can preserve intentional <br> line breaks
        const inlineTitleHTML = inlineTitleEl ? inlineTitleEl.innerHTML : null;
        const inlineDescEl = s.querySelector('.slide-desc');
        const inlineDescHTML = inlineDescEl ? inlineDescEl.innerHTML : null;

        // try to read inline logo img element
        // accept either `.slide-logo img` or `.showcase-logo img` (some slides use the latter)
        const inlineLogoImg = s.querySelector('.slide-logo img, .showcase-logo img');

        // simple fade-out/in
        if (titleEl) titleEl.style.opacity = 0;
        if (logoImg) logoImg.style.opacity = 0;
        if (descEl) descEl.style.opacity = 0;

        setTimeout(() => {
            // prefer inline .slide-title HTML (to preserve <br>), fallback to data.title
            if (inlineTitleHTML && titleEl) titleEl.innerHTML = inlineTitleHTML;
            else if (data.title && titleEl) titleEl.textContent = data.title;
            // prefer inline logo img when available, fallback to data.logo
            if (inlineLogoImg && logoImg) {
                logoImg.src = inlineLogoImg.src;
                logoImg.alt = inlineLogoImg.alt || logoImg.alt || '';
                // If the slide's logo image carries sizing classes or attributes, copy them
                try {
                    const inlineCls = inlineLogoImg.getAttribute && inlineLogoImg.getAttribute('class');
                        if (inlineCls) {
                            // apply the same classes to the visible logo (overrides previous classes)
                            logoImg.setAttribute('class', inlineCls);
                        } else {
                        // fallback to explicit width/height attributes if present
                        if (inlineLogoImg.width) logoImg.width = inlineLogoImg.width;
                        if (inlineLogoImg.height) logoImg.height = inlineLogoImg.height;
                    }
                        // copy inline style (so transforms like translateY are preserved)
                        const inlineStyle = inlineLogoImg.getAttribute && inlineLogoImg.getAttribute('style');
                        if (inlineStyle) {
                            // merge by overwriting the visible logo's style attribute
                            logoImg.setAttribute('style', inlineStyle);
                        }
                } catch (e) {
                    // ignore if something unusual (defensive)
                }
            } else if (data.logo && logoImg) {
                logoImg.src = data.logo;
                logoImg.alt = data.logoAlt || logoImg.alt || '';
            }

            // use inline .slide-desc HTML when available, otherwise fall back to data.desc
            if (inlineDescHTML && descEl) {
                descEl.innerHTML = inlineDescHTML;
            } else if (data.desc && descEl) {
                descEl.innerHTML = data.desc.replace(/\n/g, '<br>');
            }

            if (titleEl) titleEl.style.opacity = 1;
            if (logoImg) logoImg.style.opacity = 1;
            if (descEl) descEl.style.opacity = 1;
        }, 160);
    }

    function show(i) {
        slides.forEach((s, ii) => s.classList.toggle('hidden', ii !== i));
        updateTextFromSlide(i);
    }

    show(idx);

    prev && prev.addEventListener('click', () => {
        idx = (idx - 1 + slides.length) % slides.length;
        show(idx);
    });

    next && next.addEventListener('click', () => {
        idx = (idx + 1) % slides.length;
        show(idx);
    });

    let timer = setInterval(() => {
        idx = (idx + 1) % slides.length;
        show(idx);
    }, 5000);

    // Pause auto-rotate while hovering the carousel
    container.addEventListener('mouseenter', () => clearInterval(timer));
    container.addEventListener('mouseleave', () => {
        timer = setInterval(() => {
            idx = (idx + 1) % slides.length;
            show(idx);
        }, 5000);
    });
});
