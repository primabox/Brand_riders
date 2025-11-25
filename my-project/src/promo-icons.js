// promo-icons.js
// Data-tab driven promo icon behavior.
// - Each `.promo-icon` must have `data-tab="<id-of-preload-image>"`.
// - Preload images must exist in DOM with matching `id` (these are `.promo-slide-source`).
// Behavior:
// - Clicking (or Enter/Space) an icon activates its tab, sets aria-pressed, swaps `#promoCar.src` to the preload image src,
//   copies `width`/`height` attributes and updates bracketed sizing classes on `#promoCar`.

const icons = Array.from(document.querySelectorAll('.promo-icon'));
const promoCar = document.getElementById('promoCar');

// Map preload tab keys to badge element IDs
const badgeMap = {
    carPump: 'badgePump',
    carStit: 'badgeStit',
    carClean: 'badgeTire',
    car4: 'badgeDatabase'
};

// Cache badge elements (may be null if not present)
const badges = Object.values(badgeMap).reduce((acc, id) => {
    const el = document.getElementById(id);
    if (el) acc[id] = el;
    return acc;
}, {});

// Cache database coin images (penízky)
const dbCoins = Array.from(document.querySelectorAll('.promo-db-coin'));

// Cache promo title/description nodes and their originals so we can swap text per tab
const promoTitleNode = document.querySelector('.promo-title');
const promoDescNode = document.querySelector('.promo-description');
const originalPromoTitle = promoTitleNode ? promoTitleNode.innerHTML : '';
const originalPromoDesc = promoDescNode ? promoDescNode.innerHTML : '';

if (!promoCar || icons.length === 0) {
    // Nothing to do on pages without promo section.
    // eslint-disable-next-line no-console
    console.warn('promo-icons: missing #promoCar or promo icons; skipping init');
} else {
    // Initialize dataset values and event handlers
    icons.forEach((icon) => {
        // require data-tab on each icon
        const tabKey = icon.getAttribute('data-tab');
        if (!tabKey) return;

        // remember original colored src and a best-effort gray src
        icon.dataset.colorSrc = icon.src;
        // prefer explicit data-gray-src; otherwise try to derive by replacing 'Green' -> 'Gray'
        icon.dataset.graySrc = icon.dataset.graySrc || icon.src.replace(/Green/g, 'Gray').replace(/green/g, 'Gray');

        icon.addEventListener('click', () => activateTab(tabKey));
        icon.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                activateTab(tabKey);
            }
        });
    });

    function activateTab(tabKey) {
        const targetImg = document.getElementById(tabKey);
        if (!targetImg) return;

        // Update icon visuals (aria + src)
        icons.forEach((ic) => {
            const isActive = ic.getAttribute('data-tab') === tabKey;
            ic.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            ic.classList.toggle('active', isActive);
            if (isActive) {
                ic.src = ic.dataset.colorSrc || ic.src;
            } else {
                ic.src = ic.dataset.graySrc || ic.src;
            }
        });

        // Toggle badges: hide all, show the one mapped to current tab (if present)
        Object.keys(badges).forEach((id) => badges[id].classList.remove('badge--visible'));
        const badgeId = badgeMap[tabKey];
        if (badgeId && badges[badgeId]) {
            badges[badgeId].classList.add('badge--visible');
        }

        // Toggle database coins: show when car4 active, hide otherwise
        if (tabKey === 'car4') {
            dbCoins.forEach((c) => c.classList.add('badge--visible'));
        } else {
            dbCoins.forEach((c) => c.classList.remove('badge--visible'));
        }

        // Update promo title/description based on data attributes on the active icon
        if (promoTitleNode && promoDescNode) {
            const activeIcon = icons.find((i) => i.getAttribute('data-tab') === tabKey);
            const title = activeIcon && activeIcon.dataset && activeIcon.dataset.title ? activeIcon.dataset.title : null;
            const desc = activeIcon && activeIcon.dataset && activeIcon.dataset.desc ? activeIcon.dataset.desc : null;
            if (title || desc) {
                promoTitleNode.innerHTML = title || originalPromoTitle;
                // allow stored desc HTML (e.g. &nbsp; or encoded <br>) to be rendered
                promoDescNode.innerHTML = desc || originalPromoDesc;
            } else {
                promoTitleNode.innerHTML = originalPromoTitle;
                promoDescNode.innerHTML = originalPromoDesc;
            }
        }

        // Swap promo car src
        promoCar.src = targetImg.src;
        // Mark current active tab on the promoCar element so the state is visible in DOM
        promoCar.setAttribute('data-tab', tabKey);

        // If the active tab is `carPump`, add a CSS class that shifts the promo car;
        // otherwise remove that class.
        if (tabKey === 'carPump') {
            promoCar.classList.add('promo-car--shifted');
        } else {
            promoCar.classList.remove('promo-car--shifted');
        }

        // Copy explicit width/height attributes from preload image
        if (targetImg.hasAttribute('width')) promoCar.setAttribute('width', targetImg.getAttribute('width'));
        if (targetImg.hasAttribute('height')) promoCar.setAttribute('height', targetImg.getAttribute('height'));

        // Replace bracketed size classes on #promoCar with values based on the target's width/height
        const width = targetImg.getAttribute('width');
        const height = targetImg.getAttribute('height');
        if (width && height) {
            // remove existing bracketed width/height classes
            const cleaned = promoCar.className
                .replace(/\bmax-w-\[[^\]]+\]\b/g, '')
                .replace(/\bw-\[[^\]]+\]\b/g, '')
                .replace(/\bh-\[[^\]]+\]\b/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            promoCar.className = cleaned;
            promoCar.classList.add(`max-w-[${width}px]`, `w-[${width}px]`, `h-[${height}px]`);
        }
    }

    // Initialize active tab by matching current promoCar.src to preload nodes or default to first icon
    (function init() {
        const currentSrc = promoCar.src;
        let initialTab = null;
        for (const ic of icons) {
            const tab = ic.getAttribute('data-tab');
            if (!tab) continue;
            const preload = document.getElementById(tab);
            if (preload && preload.src === currentSrc) {
                initialTab = tab;
                break;
            }
        }
        if (!initialTab) {
            const first = icons.find((i) => i.getAttribute('data-tab'));
            initialTab = first ? first.getAttribute('data-tab') : null;
        }
        if (initialTab) activateTab(initialTab);
    })();
}
// End of promo-icons data-tab script
