// Accessible, robust accordion for Questions section
// Features:
// - single-open behavior
// - smooth open/close animations using measured heights
// - animation lock + queued toggles to avoid race conditions
// - keyboard support (Enter, Space, Escape)
// - re-measure when images inside an open panel load

(function () {
  const SELECTOR = '.accordion-item-wrapper';

  function qsAll(sel) { return Array.from(document.querySelectorAll(sel)); }

  function getHeaderHeight(item) {
    const header = item.querySelector('.accordion-header');
    return header ? header.getBoundingClientRect().height : 88;
  }

  function setNumericStartHeights(item) {
    const headerH = getHeaderHeight(item);
    const body = item.querySelector('.accordion-body');
    if (!item.style.maxHeight || item.style.maxHeight === 'none') item.style.maxHeight = headerH + 'px';
    if (body && (!body.style.maxHeight || body.style.maxHeight === 'none')) body.style.maxHeight = '0px';
  }

  function measureSizes(item) {
    const body = item.querySelector('.accordion-body');
    const wrapperFull = item.scrollHeight; // header + body
    const bodyFull = body ? body.scrollHeight : 0;
    return { wrapperFull, bodyFull };
  }

  // Animation helpers removed — accordion now opens/closes instantly.

  function doOpen(item) {
    const body = item.querySelector('.accordion-body');
    const headerH = getHeaderHeight(item);
    // set ARIA + classes and expand instantly
    item.setAttribute('aria-expanded', 'true');
    item.classList.add('open');
    if (body) body.classList.add('open');

    // fully expand (no transition) so content appears instantly
    item.style.maxHeight = 'none';
    if (body) body.style.maxHeight = 'none';
  }

  function doClose(item) {
    const body = item.querySelector('.accordion-body');
    const headerH = getHeaderHeight(item);
    // mark closing and collapse instantly
    item.setAttribute('aria-expanded', 'false');
    item.classList.remove('open');
    if (body) body.classList.remove('open');

    // collapse to header height immediately
    item.style.maxHeight = headerH + 'px';
    if (body) body.style.maxHeight = '0px';
  }

  // Public toggle which queues if animating
  function toggleItem(item) {
    if (!item) return;
    const isOpen = item.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      doClose(item);
    } else {
      // close others first
      const others = qsAll(SELECTOR).filter(i => i !== item);
      others.forEach(i => {
        if (i.getAttribute('aria-expanded') === 'true') doClose(i);
      });
      doOpen(item);
    }
  }

  // Attach image load listeners so sizes are re-measured if images inside body load after open
  function watchImages(item) {
    const imgs = Array.from(item.querySelectorAll('img'));
    imgs.forEach(img => {
      if (img.complete) return;
      const onLoad = () => {
        // if item is open, re-measure and update max-heights
        if (item.getAttribute('aria-expanded') === 'true') {
          // allow natural growth after images load
          item.style.maxHeight = 'none';
          const body = item.querySelector('.accordion-body');
          if (body) body.style.maxHeight = 'none';
        }
        img.removeEventListener('load', onLoad);
      };
      img.addEventListener('load', onLoad);
    });
  }

  // Watch for DOM changes inside the body (text changes, injected nodes) and re-measure when open
  function watchMutations(item) {
    const body = item.querySelector('.accordion-body');
    if (!body || !window.MutationObserver) return;
    const obs = new MutationObserver((mutations) => {
      if (item.getAttribute('aria-expanded') === 'true') {
        // allow natural growth when content changes
        item.style.maxHeight = 'none';
        body.style.maxHeight = 'none';
      }
    });
    obs.observe(body, { childList: true, subtree: true, characterData: true });
    // store observer so it can be disconnected later if needed
    item._mutObserver = obs;
  }

  // Transition fallback removed — not needed for instant open/close.

  function initItem(item) {
    // ensure attribute defaults
    if (!item.hasAttribute('aria-expanded')) item.setAttribute('aria-expanded', 'false');
    // no queued animation state required for instant toggles

    const header = item.querySelector('.accordion-header');
    const body = item.querySelector('.accordion-body');

    // initial collapsed state
    const headerH = getHeaderHeight(item);
    item.style.maxHeight = headerH + 'px';
    if (body) body.style.maxHeight = '0px';

    // click on header toggles
    if (header) header.addEventListener('click', (e) => {
      e.preventDefault();
      try { item.focus({ preventScroll: true }); } catch (err) { item.focus(); }
      toggleItem(item);
    });

    // keyboard on wrapper
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleItem(item);
      } else if (e.key === 'Escape') {
        if (item.getAttribute('aria-expanded') === 'true') toggleItem(item);
      }
    });

    // No transitionend handler — open/close are instantaneous.

    // observe images to remeasure if needed
    watchImages(item);
  }

  function initAccordion() {
    const items = qsAll(SELECTOR);
    if (!items.length) return;

    // make wrappers focusable for keyboard interaction
    items.forEach(item => {
      if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '0');
      if (!item.hasAttribute('role')) item.setAttribute('role', 'button');
      initItem(item);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAccordion);
  else initAccordion();

})();
