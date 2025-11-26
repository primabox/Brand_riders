// Simple accordion controller that measures content height and animates via CSS `max-height`.
// - Adds/removes classes `expanded` on the wrapper and `open` on the body.
// - Sets an explicit inline `maxHeight` for a smooth transition that works with dynamic content.
document.addEventListener('DOMContentLoaded', () => {
  const items = document.querySelectorAll('.accordion-item-wrapper');

  items.forEach(item => {
    const header = item.querySelector('.accordion-header');
    const body = item.querySelector('.accordion-body');
    if (!header || !body) return;

    // Ensure accessible state exists
    if (!item.hasAttribute('aria-expanded')) item.setAttribute('aria-expanded', 'false');

    header.addEventListener('click', () => {
      const isOpen = item.classList.contains('expanded');
      item.classList.add('animating');

      if (isOpen) {
        // Closing: set current height then animate to 0.
        // Keep the `.open` class until the transition finishes so padding/opacity
        // don't collapse instantly — remove it on `transitionend`.
        const currentHeight = body.scrollHeight;
        body.style.maxHeight = currentHeight + 'px';

        // Start transition to 0 on next frame
        requestAnimationFrame(() => {
          body.style.maxHeight = '0px';
        });

        item.setAttribute('aria-expanded', 'false');

        // Remove `.open` and cleanup when the max-height transition ends
        const onCloseEnd = (e) => {
          if (e.propertyName !== 'max-height') return;
          body.classList.remove('open');
          item.classList.remove('expanded');
          item.classList.remove('animating');
          body.style.maxHeight = '';
          body.removeEventListener('transitionend', onCloseEnd);
        };

        body.addEventListener('transitionend', onCloseEnd);
      } else {
        // Opening: mark expanded so wrapper can grow, then animate to measured height
        item.classList.add('expanded');
        item.setAttribute('aria-expanded', 'true');
        body.classList.add('open');

        // Start from 0, then set to scrollHeight to animate open.
        body.style.maxHeight = '0px';
        requestAnimationFrame(() => {
          const target = body.scrollHeight;
          body.style.maxHeight = target + 'px';
        });

        // Cleanup after transition finishes to remove inline max-height
        const onOpenEnd = (e) => {
          if (e.propertyName !== 'max-height') return;
          body.style.maxHeight = '';
          item.classList.remove('animating');
          body.removeEventListener('transitionend', onOpenEnd);
        };

        body.addEventListener('transitionend', onOpenEnd);
      }
    });
  });
});

// Export nothing (ES module import if using bundler): import './accordion.js' in your main entry.
