// Simple carousel control: toggles active dot and exposes events for slide changes.
(function () {
  const prevBtn = document.querySelector('.hero-arrow--left');
  const nextBtn = document.querySelector('.hero-arrow--right');
  const dots = Array.from(document.querySelectorAll('.hero-dots .dot'));
  const slides = Array.from(document.querySelectorAll('.hero-slides .hero-slide'));
  const track = document.querySelector('.hero-slides-track');
  if (!dots.length || !prevBtn || !nextBtn) return;

  let current = dots.findIndex(d => d.classList.contains('active'));
  if (current === -1) current = 0;

  function setActive(index) {
    index = (index + dots.length) % dots.length;
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
    current = index;
    // Move sliding track if present (use slide index modulo slides length)
    if (track && slides.length) {
      const slideIndex = index % slides.length;
      // translate by viewport widths so the track moves full-screen
      track.style.transform = `translateX(-${slideIndex * 100}vw)`;
      slides.forEach((s, i) => {
        s.classList.toggle('active', i === slideIndex);
        s.setAttribute('aria-hidden', i === slideIndex ? 'false' : 'true');
      });
    }
    const evt = new CustomEvent('carousel:change', { detail: { index } });
    document.querySelector('.hero-carousel')?.dispatchEvent(evt);
  }

  prevBtn.addEventListener('click', () => setActive(current - 1));
  nextBtn.addEventListener('click', () => setActive(current + 1));

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => setActive(i));
  });

  // Initialize to current state so slides/dots are in sync
  setActive(current);

  // Expose on window for debugging
  window.__heroCarousel = { setActive };
})();


