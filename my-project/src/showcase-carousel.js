document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.showcase-carousel');
    if (!container) return;

    const slides = Array.from(container.querySelectorAll('.slide'));
    // prev/next buttons live in the text column; search container-wide
    const prev = container.querySelector('.showcase-prev');
    const next = container.querySelector('.showcase-next');
    let idx = 0;

    function show(i) {
        slides.forEach((s, ii) => s.classList.toggle('hidden', ii !== i));
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
