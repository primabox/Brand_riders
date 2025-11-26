// Simple carousel control: toggles active dot and exposes events for slide changes.
(function () {
  const prevBtn = document.querySelector('.hero-arrow--left');
  const nextBtn = document.querySelector('.hero-arrow--right');
  const dotsList = document.querySelector('.hero-dots');
  const dots = Array.from(document.querySelectorAll('.hero-dots .dot'));
  const dotsWrap = document.querySelector('.hero-dots-wrap');
  const slides = Array.from(document.querySelectorAll('.hero-slides .hero-slide'));
  const track = document.querySelector('.hero-slides-track');
  if (!dots.length || !prevBtn || !nextBtn || !dotsList) return;

  // How many dots to show at a time in the visible window
  const VISIBLE_DOTS = 5;

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

    // Center the dots window: compute an offset so active dot is centered when possible
    if (dots.length > VISIBLE_DOTS && dotsList && dotsWrap) {
      const half = Math.floor(VISIBLE_DOTS / 2);
      let offsetIndex = index - half;
      offsetIndex = Math.max(0, Math.min(offsetIndex, dots.length - VISIBLE_DOTS));

      // compute each step as dot width + gap (read from computed styles)
      const dotEl = dots[0];
      const gapValue = parseFloat(getComputedStyle(dotsList).gap) || 12;
      const step = Math.round(dotEl.getBoundingClientRect().width + gapValue);
      dotsList.style.transform = `translateX(-${offsetIndex * step}px)`;
    } else if (dotsList) {
      dotsList.style.transform = 'translateX(0)';
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

  // --- Touch / swipe support for mobile: allow finger swipes to change slides ---
  // Simple detection: record touchstart, compare to touchend, trigger next/prev on sufficient horizontal delta
  (function attachSwipe() {
    const swipeContainer = document.querySelector('.hero-slides') || track;
    if (!swipeContainer) return;

    let startX = 0;
    let startY = 0;
    let isTouching = false;

    const THRESHOLD = 40; // px required to consider a swipe

    swipeContainer.addEventListener('touchstart', function (e) {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      isTouching = true;
    }, { passive: true });

    swipeContainer.addEventListener('touchmove', function (e) {
      // no-op; we don't perform live dragging to keep implementation simple and avoid scroll conflicts
      // leave passive to true so the browser can optimize scrolling
    }, { passive: true });

    swipeContainer.addEventListener('touchend', function (e) {
      if (!isTouching) return;
      isTouching = false;
      // Touchend doesn't provide coordinates in the same way; use changedTouches
      const t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // Only consider mostly-horizontal gestures
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > THRESHOLD) {
        if (dx < 0) {
          // swipe left -> next
          setActive(current + 1);
        } else {
          // swipe right -> prev
          setActive(current - 1);
        }
      }
    }, { passive: true });
  })();
})();


