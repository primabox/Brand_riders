// Simple accordion toggles for the Questions section
// Accordion: robust in-place expansion with keyboard support and transition cleanup
function initAccordion() {
  const items = document.querySelectorAll('.accordion-item-wrapper');
  if (!items || items.length === 0) return;

  function getHeaderHeight(item) {
    const header = item.querySelector('.accordion-header');
    return header ? header.offsetHeight : 88;
  }

  function closeItem(item) {
    const body = item.querySelector('.accordion-body');
    const headerHeight = getHeaderHeight(item);
    item.setAttribute('aria-expanded', 'false');
    item.classList.remove('open');

    // If wrapper previously had 'none' (no max-height), start from its current scrollHeight
    // so the transition to headerHeight animates smoothly.
    let startHeight;
    if (!item.style.maxHeight || item.style.maxHeight === 'none') {
      // measure current full height
      startHeight = item.scrollHeight;
      item.style.maxHeight = startHeight + 'px';
    } else {
      // parse existing pixel value or fallback to scrollHeight
      const m = parseFloat(item.style.maxHeight);
      startHeight = isFinite(m) ? m : item.scrollHeight;
      item.style.maxHeight = startHeight + 'px';
    }

    // ensure body starts from its current height so it animates to 0
    if (body) {
      if (!body.style.maxHeight || body.style.maxHeight === 'none') {
        body.style.maxHeight = body.scrollHeight + 'px';
      }
      body.classList.remove('open');
    }

    // animate to collapsed sizes on next frame
    requestAnimationFrame(() => {
      item.style.maxHeight = headerHeight + 'px';
      if (body) body.style.maxHeight = '0px';
    });
  }

  function openItem(item) {
    const body = item.querySelector('.accordion-body');
    if (!body) return;

    const headerHeight = getHeaderHeight(item);

    // mark expanded state
    item.setAttribute('aria-expanded', 'true');
    item.classList.add('open');
    body.classList.add('open');

    // measure needed sizes
    // temporarily remove max-height so scrollHeight reports full size
    const prevMax = item.style.maxHeight;
    item.style.maxHeight = 'none';
    const needed = item.scrollHeight; // header + body
    // restore and animate to measured height
    item.style.maxHeight = prevMax || headerHeight + 'px';

    // set body target
    const bodyHeight = body.scrollHeight;

    requestAnimationFrame(() => {
      item.style.maxHeight = needed + 'px';
      body.style.maxHeight = bodyHeight + 'px';
    });
  }

  // Ensure only one open at a time
  function toggleItem(item) {
    const isOpen = item.getAttribute('aria-expanded') === 'true';
    items.forEach(i => { if (i !== item) closeItem(i); });
    if (isOpen) closeItem(item); else openItem(item);
  }

  items.forEach(item => {
    const header = item.querySelector('.accordion-header');
    const body = item.querySelector('.accordion-body');

    // Initialize starting heights
    const headerHeight = getHeaderHeight(item);
    item.style.maxHeight = headerHeight + 'px';
    if (body) body.style.maxHeight = '0px';

    if (header) {
      header.addEventListener('click', (e) => {
        e.preventDefault();
        // move focus to the wrapper so focus styles (green outline) appear on click
        try { item.focus({ preventScroll: true }); } catch (err) { item.focus(); }
        toggleItem(item);
      });
    }

    // Keyboard: support Enter / Space on the wrapper (role=button on wrapper)
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleItem(item);
      }
      if (e.key === 'Escape') {
        closeItem(item);
      }
    });

    // After transition ends, if opened, remove max-height restriction so content can grow naturally
    item.addEventListener('transitionend', (ev) => {
      if (ev.propertyName !== 'max-height') return;
      const isOpen = item.getAttribute('aria-expanded') === 'true';
      const body = item.querySelector('.accordion-body');
      if (isOpen) {
        // remove wrapper maxHeight constraint so responsive content can expand
        item.style.maxHeight = 'none';
        if (body) body.style.maxHeight = 'none';
      } else {
        // ensure closed state stays snapped to header height
        const h = getHeaderHeight(item);
        item.style.maxHeight = h + 'px';
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAccordion);
} else {
  // DOM already ready
  initAccordion();
}
