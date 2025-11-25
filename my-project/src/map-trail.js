const section = document.querySelector('.map-trail-section');
if (!section) {
  // nothing to do
  console.warn('map-trail: section not found');
} else {
  const svg = section.querySelector('#mapTrailSvg');
  const path = svg && svg.querySelector('#trailPath');
  const car = document.getElementById('mapCar');
  const VB_W = 1165;
  const VB_H = 2130;
  // fraction of the section that must be visible before the car starts moving
  // lower value = car appears and starts moving earlier (0 = immediately)
  const START_OFFSET = 0.05;
  // vertical shift (pixels) applied to generated trace to better align with the white ribbon
  const VERTICAL_SHIFT = 12;
    // >1 delays progress early and concentrates movement later along the path.
    // Increase to make turns happen later (e.g. 1.5..2.5). 1 = linear.
    // Raised to 2.2 to make the car start turning noticeably later.
    const PROGRESS_POWER = 2.2;
    // base multiplier applied to make the car move faster in the early/mid section
    // 1.0 = normal, >1 moves the car further along the path for the same scroll.
    const BASE_SPEED_MULTIPLIER = 1.8;
    // controls how quickly the extra speed tapers off toward the end (higher = stronger taper)
    // increased significantly so the extra speed remains until very near the end
    const END_SLOW_POWER = 6.0;
    // how many preview points to skip when drawing small red dots (1 = draw all)
    // increase to reduce visual clutter (higher = fewer dots)
    const PREVIEW_DOT_DECIMATE = 5;

  if (!svg || !path || !car) {
    console.warn('map-trail: missing svg/path/car elements');
  } else {
    let pathLength = path.getTotalLength();
    let svgRect = svg.getBoundingClientRect();
    let needsUpdate = true;
    let latestScrollY = window.scrollY;
    const DEBUG = true; // set to false to disable visual debug
    let debugCircle = null;
    let lastLog = 0;

    function updateRects() {
      svgRect = svg.getBoundingClientRect();
      pathLength = path.getTotalLength();
    }

    function clamp(v, a = 0, b = 1) {
      return Math.max(a, Math.min(b, v));
    }

    // Chaikin subdivision for smoothing a polyline
    function chaikinSmooth(points, iterations = 2) {
      if (!points || points.length < 2) return points.slice();
      let pts = points.map(p => ({ x: p.x, y: p.y }));
      for (let it = 0; it < iterations; it++) {
        const out = [];
        out.push(pts[0]);
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i];
          const p1 = pts[i + 1];
          const q = { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y };
          const r = { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y };
          out.push(q);
          out.push(r);
        }
        out.push(pts[pts.length - 1]);
        pts = out;
      }
      return pts;
    }

    // Convert a set of points (Catmull-Rom) into a smooth cubic Bezier path string
    // tension: 1.0 = standard Catmull-Rom
    function catmullRomToBezier(points, tension = 1) {
      if (!points || points.length === 0) return '';
      if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
      if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

      const d = [];
      d.push(`M ${points[0].x} ${points[0].y}`);
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = i === 0 ? points[0] : points[i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = i + 2 < points.length ? points[i + 2] : points[points.length - 1];

        const c1x = p1.x + (p2.x - p0.x) / 6 * tension;
        const c1y = p1.y + (p2.y - p0.y) / 6 * tension;
        const c2x = p2.x - (p3.x - p1.x) / 6 * tension;
        const c2y = p2.y - (p3.y - p1.y) / 6 * tension;

        d.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`);
      }
      return d.join(' ');
    }

      // Ramer-Douglas-Peucker polyline simplification
      function rdp(points, eps) {
        if (!points || points.length < 3) return points.slice();
        const sqr = v => v * v;
        function distPtSeg(px, py, x1, y1, x2, y2) {
          const dx = x2 - x1, dy = y2 - y1;
          if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
          const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
          if (t < 0) return Math.hypot(px - x1, py - y1);
          if (t > 1) return Math.hypot(px - x2, py - y2);
          const projx = x1 + t * dx, projy = y1 + t * dy;
          return Math.hypot(px - projx, py - projy);
        }
        function simplify(pts, first, last, keep) {
          let maxd = 0, idx = -1;
          const x1 = pts[first].x, y1 = pts[first].y;
          const x2 = pts[last].x, y2 = pts[last].y;
          for (let i = first + 1; i < last; i++) {
            const d = distPtSeg(pts[i].x, pts[i].y, x1, y1, x2, y2);
            if (d > maxd) { maxd = d; idx = i; }
          }
          if (maxd > eps) {
            keep[idx] = true;
            simplify(pts, first, idx, keep);
            simplify(pts, idx, last, keep);
          }
        }
        const keep = new Array(points.length).fill(false);
        keep[0] = keep[points.length - 1] = true;
        simplify(points, 0, points.length - 1, keep);
        const out = [];
        for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
        return out;
      }

      // Convert canvas RGBA data to a binary mask (1 = white/band, 0 = background)
      function toBinaryMask(data, w, h, threshold = 220) {
        const mask = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const bright = (r + g + b) / 3;
            mask[y * w + x] = bright >= threshold ? 1 : 0;
          }
        }
        return mask;
      }

      // Zhang-Suen thinning (binary image: 1 foreground, 0 background)
      // Returns a new Uint8Array mask with skeleton pixels = 1
      function zhangSuenThinning(srcMask, w, h) {
        const img = new Uint8Array(srcMask); // copy
        const changed = new Uint8Array(w * h);

        const idx = (x, y) => y * w + x;

        function neighbors(x, y) {
          const n = [];
          n.push(img[idx(x, y - 1)]); // N
          n.push(img[idx(x + 1, y - 1)]); // NE
          n.push(img[idx(x + 1, y)]); // E
          n.push(img[idx(x + 1, y + 1)]); // SE
          n.push(img[idx(x, y + 1)]); // S
          n.push(img[idx(x - 1, y + 1)]); // SW
          n.push(img[idx(x - 1, y)]); // W
          n.push(img[idx(x - 1, y - 1)]); // NW
          return n;
        }

        // pad edges as background by treating out-of-bounds as 0
        function get(x, y) { if (x < 0 || x >= w || y < 0 || y >= h) return 0; return img[idx(x, y)]; }

        let any = true;
        while (any) {
          any = false;
          // step 1
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const p = get(x, y);
              if (!p) continue;
              const n = neighbors(x, y);
              const transitions = n.reduce((acc, cur, i) => acc + ((cur === 0 && n[(i + 1) % 8] === 1) ? 1 : 0), 0);
              const count = n.reduce((s, v) => s + v, 0);
              if (count >= 2 && count <= 6 && transitions === 1) {
                if ((n[0] * n[2] * n[4]) === 0 && (n[2] * n[4] * n[6]) === 0) {
                  changed[idx(x, y)] = 1;
                }
              }
            }
          }
          for (let i = 0; i < img.length; i++) {
            if (changed[i]) { img[i] = 0; any = true; changed[i] = 0; }
          }
          // step 2
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const p = get(x, y);
              if (!p) continue;
              const n = neighbors(x, y);
              const transitions = n.reduce((acc, cur, i) => acc + ((cur === 0 && n[(i + 1) % 8] === 1) ? 1 : 0), 0);
              const count = n.reduce((s, v) => s + v, 0);
              if (count >= 2 && count <= 6 && transitions === 1) {
                if ((n[0] * n[2] * n[6]) === 0 && (n[0] * n[4] * n[6]) === 0) {
                  changed[idx(x, y)] = 1;
                }
              }
            }
          }
          for (let i = 0; i < img.length; i++) {
            if (changed[i]) { img[i] = 0; any = true; changed[i] = 0; }
          }
        }
        return img;
      }

      // Remove endpoints iteratively to prune small spur branches from a skeleton
      function pruneEndpoints(mask, w, h, iterations = 8) {
        const img = new Uint8Array(mask);
        const idx = (x, y) => y * w + x;
        const get = (x, y) => (x < 0 || x >= w || y < 0 || y >= h) ? 0 : img[idx(x, y)];
        for (let it = 0; it < iterations; it++) {
          const toRemove = [];
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              if (!get(x, y)) continue;
              // count 8-neighbors
              let n = 0;
              for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
                if (ox === 0 && oy === 0) continue;
                if (get(x + ox, y + oy)) n++;
              }
              if (n <= 1) toRemove.push(idx(x, y));
            }
          }
          if (toRemove.length === 0) break;
          toRemove.forEach(i => img[i] = 0);
        }
        return img;
      }

      // Keep only the largest connected component from a binary mask
      function largestComponent(mask, w, h) {
        const img = new Uint8Array(mask);
        const visited = new Uint8Array(w * h);
        const comps = [];
        const idx = (x, y) => y * w + x;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = idx(x, y);
            if (!img[i] || visited[i]) continue;
            // flood fill
            const stack = [i];
            visited[i] = 1;
            const comp = [i];
            while (stack.length) {
              const cur = stack.pop();
              const cx = cur % w, cy = Math.floor(cur / w);
              for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
                if (ox === 0 && oy === 0) continue;
                const nx = cx + ox, ny = cy + oy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                const ni = idx(nx, ny);
                if (!visited[ni] && img[ni]) { visited[ni] = 1; stack.push(ni); comp.push(ni); }
              }
            }
            comps.push(comp);
          }
        }
        if (comps.length === 0) return img;
        comps.sort((a, b) => b.length - a.length);
        const main = new Uint8Array(w * h);
        comps[0].forEach(i => main[i] = 1);
        return main;
      }

      // Basic morphology: dilation (8-neighborhood)
      function dilate(mask, w, h, iterations = 1) {
        let img = new Uint8Array(mask);
        const out = new Uint8Array(w * h);
        const idx = (x, y) => y * w + x;
        for (let it = 0; it < iterations; it++) {
          out.fill(0);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (img[idx(x, y)]) {
                for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
                  const nx = x + ox, ny = y + oy;
                  if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[idx(nx, ny)] = 1;
                }
              }
            }
          }
          img = new Uint8Array(out);
        }
        return img;
      }

      // Basic morphology: erosion (8-neighborhood)
      function erode(mask, w, h, iterations = 1) {
        let img = new Uint8Array(mask);
        const out = new Uint8Array(w * h);
        const idx = (x, y) => y * w + x;
        for (let it = 0; it < iterations; it++) {
          out.fill(0);
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              let ok = 1;
              for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
                if (!img[idx(x + ox, y + oy)]) { ok = 0; break; }
              }
              if (ok) out[idx(x, y)] = 1;
            }
          }
          img = new Uint8Array(out);
        }
        return img;
      }

      function closeMask(mask, w, h, iter = 1) {
        return erode(dilate(mask, w, h, iter), w, h, iter);
      }

      // Extract a longest path from a skeleton mask using two-stage BFS (approx diameter)
      function extractLongestPath(skel, w, h) {
        const idx = (x, y) => y * w + x;
        const toXY = i => ({ x: i % w, y: Math.floor(i / w) });
        const n = w * h;
        // find any skeleton pixel
        let start = -1;
        for (let i = 0; i < n; i++) if (skel[i]) { start = i; break; }
        if (start === -1) return [];

        function bfs(from) {
          const q = [from];
          const dist = new Int32Array(n).fill(-1);
          const parent = new Int32Array(n).fill(-1);
          dist[from] = 0;
          for (let qi = 0; qi < q.length; qi++) {
            const cur = q[qi];
            const cx = cur % w, cy = Math.floor(cur / w);
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
              if (ox === 0 && oy === 0) continue;
              const nx = cx + ox, ny = cy + oy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              const ni = idx(nx, ny);
              if (skel[ni] && dist[ni] === -1) { dist[ni] = dist[cur] + 1; parent[ni] = cur; q.push(ni); }
            }
          }
          // find farthest
          let far = from, best = 0;
          for (let i = 0; i < n; i++) if (dist[i] > best) { best = dist[i]; far = i; }
          return { far, parent, dist };
        }

        const a = bfs(start).far;
        const res = bfs(a);
        const b = res.far;
        // reconstruct path from b to a
        const path = [];
        let cur = b;
        while (cur !== -1) {
          path.push(toXY(cur));
          if (cur === a) break;
          cur = res.parent[cur];
        }
        return path.reverse();
      }

    function getProgress() {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // compute progress as how far the viewport passes over the section
      // 0 => section is still below viewport; 1 => section has fully passed above viewport
      const total = vh + rect.height;
      const p = (vh - rect.top) / (total || 1);
      return clamp(p, 0, 1);
    }
    function updateCar() {
      // Recompute measurements
      updateRects();

      const progress = getProgress();
      const clampedProgress = clamp(progress, 0, 1);

      // car remains hidden until the user has scrolled into the section by START_OFFSET
      if (clampedProgress < START_OFFSET) {
        car.style.opacity = '0';
        return;
      } else {
        car.style.opacity = '1';
      }

      // remap progress so the movement happens between START_OFFSET..1 -> 0..1
      const rawEffective = clamp((clampedProgress - START_OFFSET) / (1 - START_OFFSET), 0, 1);
      // apply easing (power > 1 delays early progress so turns happen later)
      const eased = Math.pow(rawEffective, PROGRESS_POWER);
      // dynamic multiplier: start near BASE_SPEED_MULTIPLIER, but taper back to 1 near the end
      const dynamicMultiplier = 1 + (BASE_SPEED_MULTIPLIER - 1) * (1 - Math.pow(rawEffective, END_SLOW_POWER));
      let effective = eased * dynamicMultiplier;
      // clamp after multiplier so we don't jump past the end
      effective = clamp(effective, 0, 1);
      const dist = effective * pathLength;
      if (!pathLength || isNaN(dist)) return;

      const point = path.getPointAtLength(dist);

      // convert SVG (viewBox) coords to screen coords using the SVG CTM — more reliable when preserveAspectRatio is used
      let x = point.x;
      let y = point.y;
      try {
        const ctm = svg.getScreenCTM && svg.getScreenCTM();
        if (ctm) {
          const pt = svg.createSVGPoint();
          pt.x = point.x;
          pt.y = point.y;
          const screen = pt.matrixTransform(ctm);
          x = screen.x;
          y = screen.y;
        } else {
          throw new Error('no ctm');
        }
      } catch (err) {
        // fallback to bounding rect scaling if createSVGPoint / getScreenCTM not available
        const scaleX = svgRect.width / VB_W || 1;
        const scaleY = svgRect.height / VB_H || 1;
        x = svgRect.left + point.x * scaleX;
        y = svgRect.top + point.y * scaleY;
      }

      // set transform (use fixed positioning coordinates) — DO NOT rotate the car
      car.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;

      // DEBUG: draw pointer and make path visible
      if (DEBUG) {
        try {
          path.style.stroke = 'rgba(255,255,255,0.9)';
          path.style.strokeWidth = '6';
          if (!debugCircle) {
            debugCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            debugCircle.setAttribute('id', 'trailPointer');
            debugCircle.setAttribute('r', '8');
            debugCircle.setAttribute('fill', 'rgba(255,0,0,0.9)');
            svg.appendChild(debugCircle);
          }
          debugCircle.setAttribute('cx', point.x);
          debugCircle.setAttribute('cy', point.y);
        } catch (e) {
          // ignore debug drawing errors
        }

        // occasional console logging to inspect values
        const now = Date.now();
        if (now - lastLog > 300) {
          lastLog = now;
          console.log('map-trail:', { pathLength, progress: clampedProgress, dist, svgRect, point });
        }
      }
    }

    // RAF loop
    function tick() {
      // run update every frame for smoothness; inexpensive operations only
      updateCar();
      requestAnimationFrame(tick);
    }

    // event hooks
    window.addEventListener('scroll', () => { needsUpdate = true; });
    window.addEventListener('resize', () => { needsUpdate = true; });

    // initial
    updateRects();
    requestAnimationFrame(tick);
    // --- Interactive trace editor (DEBUG only) ---------------------------------
    // Click on the visible blue trail to add points. Use the on-screen buttons
    // to finish and convert the clicks to a proper `d` path used by the car.
    if (DEBUG) {
      let tracing = false;
      let tracePoints = [];
      let traceLayer = null;

      // create control UI
      const controls = document.createElement('div');
      controls.style.position = 'absolute';
      controls.style.right = '12px';
      controls.style.top = '12px';
      controls.style.zIndex = '120';
      controls.style.display = 'flex';
      controls.style.gap = '8px';

      const startBtn = document.createElement('button');
      startBtn.textContent = 'Start Trace';
      startBtn.style.padding = '6px 8px';
      const autoBtn = document.createElement('button');
      autoBtn.textContent = 'Auto Trace';
      autoBtn.style.padding = '6px 8px';
      const finishBtn = document.createElement('button');
      finishBtn.textContent = 'Finish Trace';
      finishBtn.style.padding = '6px 8px';
      const clearBtn = document.createElement('button');
      clearBtn.textContent = 'Clear';
      clearBtn.style.padding = '6px 8px';

      controls.appendChild(startBtn);
      controls.appendChild(autoBtn);
      controls.appendChild(finishBtn);
      controls.appendChild(clearBtn);
      section.style.position = section.style.position || 'relative';
      section.appendChild(controls);

      function ensureTraceLayer() {
        if (!traceLayer) {
          traceLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          traceLayer.setAttribute('id', 'traceLayer');
          svg.appendChild(traceLayer);
        }
      }

      function drawTracePreview() {
        ensureTraceLayer();
        // remove previous preview shapes
        while (traceLayer.firstChild) traceLayer.removeChild(traceLayer.firstChild);
        if (tracePoints.length === 0) return;
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        const pts = tracePoints.map(p => `${p.x},${p.y}`).join(' ');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', 'rgba(255,255,255,0.9)');
        poly.setAttribute('stroke-width', '4');
        poly.setAttribute('stroke-linecap', 'round');
        poly.setAttribute('stroke-linejoin', 'round');
        traceLayer.appendChild(poly);
        // small circles (decimated to reduce clutter)
        for (let i = 0; i < tracePoints.length; i += PREVIEW_DOT_DECIMATE) {
          const p = tracePoints[i];
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('cx', p.x);
          c.setAttribute('cy', p.y);
          c.setAttribute('r', '3');
          c.setAttribute('fill', 'rgba(255,0,0,0.85)');
          traceLayer.appendChild(c);
        }
      }

      // Try an automatic trace by scanning the raster image for blue pixels.
      async function autoTrace() {
        // Improved automatic tracing:
        // - loads the embedded raster image into a canvas sized to the SVG viewBox
        // - for each sampled row finds the longest run of "blue/bright" pixels and uses its center
        // - applies a moving-average smoothing and decimates points for a clean path
        try {
          autoBtn.disabled = true;
          const imgEl = svg.querySelector('image');
          if (!imgEl) throw new Error('no svg image found');
          const src = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
          if (!src) throw new Error('image href not found');

          const img = new Image();
          img.crossOrigin = 'Anonymous';
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });

          const cw = VB_W;
          const ch = VB_H;
          const c = document.createElement('canvas');
          c.width = cw;
          c.height = ch;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          const data = ctx.getImageData(0, 0, cw, ch).data;

          // Build binary mask and compute skeleton (thin centerline)
          const whiteThreshold = 220;
          const mask = toBinaryMask(data, cw, ch, whiteThreshold);

          // compute bounding box of the white band so we can clamp shifted points
          function maskBounds(maskArr, w, h) {
            let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                if (maskArr[y * w + x]) {
                  found = true;
                  if (x < minX) minX = x;
                  if (y < minY) minY = y;
                  if (x > maxX) maxX = x;
                  if (y > maxY) maxY = y;
                }
              }
            }
            if (!found) return null;
            return { minX, minY, maxX, maxY };
          }

          // more aggressive morphological closing to fill small gaps then skeletonize
          const closed = closeMask(mask, cw, ch, 2);
          const skel = zhangSuenThinning(closed, cw, ch);
          // prune short spurs then keep largest connected skeleton component (more aggressive)
          const pruned = pruneEndpoints(skel, cw, ch, 20);
          const mainSkel = largestComponent(pruned, cw, ch);

          // Try to extract the continuous main spine as a pixel path
          let pathPixels = extractLongestPath(mainSkel, cw, ch);
          const pts = [];
          if (pathPixels && pathPixels.length > 6) {
            // decimate pixel path to reduce density
            const decimate = 4;
            for (let i = 0; i < pathPixels.length; i += decimate) pts.push(pathPixels[i]);
            if (pathPixels.length > 0 && (pts.length === 0 || pts[pts.length - 1].y !== pathPixels[pathPixels.length - 1].y)) pts.push(pathPixels[pathPixels.length - 1]);
          } else {
            // fallback: collect skeleton centers by scanning rows
            const stepY = 3;
            for (let y = 0; y < ch; y += stepY) {
              let sx = 0, cnt = 0;
              for (let x = 0; x < cw; x++) {
                if (mainSkel[y * cw + x]) { sx += x; cnt++; }
              }
              if (cnt === 0) continue;
              pts.push({ x: sx / cnt, y });
            }
          }

          // remember original endpoints (from pixel spine if available, otherwise from pts)
          let origStart = null, origEnd = null;
          if (pathPixels && pathPixels.length > 1) {
            origStart = pathPixels[0];
            origEnd = pathPixels[pathPixels.length - 1];
          } else if (pts.length > 1) {
            origStart = pts[0];
            origEnd = pts[pts.length - 1];
          }

          if (pts.length < 3) throw new Error('auto-trace found too few candidate points');

          // smoothing pipeline: simplify -> decimate -> Chaikin
          const simplifyEps = 1.2; // pixel tolerance for RDP simplification
          let simplified = rdp(pts, simplifyEps);
          const decimate = 3;
          const dec = [];
          for (let i = 0; i < simplified.length; i += decimate) dec.push(simplified[i]);
          if (simplified.length > 0 && (dec.length === 0 || dec[dec.length - 1].y !== simplified[simplified.length - 1].y)) dec.push(simplified[simplified.length - 1]);

          // apply stronger Chaikin smoothing to remove small wiggles
          const smooth = chaikinSmooth(dec, 4);

          // apply vertical shift and store preview points (in SVG coordinates)
          const bounds = maskBounds(closed, cw, ch);
          let shifted = smooth.map(p => {
            let x = p.x;
            let y = p.y + VERTICAL_SHIFT;
            if (bounds) {
              x = Math.min(Math.max(x, bounds.minX), bounds.maxX);
              y = Math.min(Math.max(y, bounds.minY), bounds.maxY);
            } else {
              // fallback: clamp to viewBox extents
              x = Math.min(Math.max(x, 0), cw);
              y = Math.min(Math.max(y, 0), ch);
            }
            return { x, y };
          });

          // Snap the curve endpoints to the original detected endpoints (origStart/origEnd)
          // and gently straighten the initial segment so the first turn looks straight.
          if (origStart && origEnd) {
            const sxv = origStart.x;
            const syv = origStart.y + VERTICAL_SHIFT;
            const exv = origEnd.x;
            const eyv = origEnd.y + VERTICAL_SHIFT;
            const sx = bounds ? Math.min(Math.max(sxv, bounds.minX), bounds.maxX) : Math.min(Math.max(sxv, 0), cw);
            const sy = bounds ? Math.min(Math.max(syv, bounds.minY), bounds.maxY) : Math.min(Math.max(syv, 0), ch);
            const ex = bounds ? Math.min(Math.max(exv, bounds.minX), bounds.maxX) : Math.min(Math.max(exv, 0), cw);
            const ey = bounds ? Math.min(Math.max(eyv, bounds.minY), bounds.maxY) : Math.min(Math.max(eyv, 0), ch);
            shifted[0] = { x: sx, y: sy };
            shifted[shifted.length - 1] = { x: ex, y: ey };
            // straighten first several points by interpolating toward a later target to reduce early curvature
            const straightenCount = Math.min(6, shifted.length - 2);
            if (shifted.length > 6 && straightenCount > 0) {
              const targetIdx = Math.min(5, shifted.length - 1);
              const target = shifted[targetIdx];
              for (let i = 1; i <= straightenCount; i++) {
                const t = i / (straightenCount + 1);
                shifted[i] = { x: sx * (1 - t) + target.x * t, y: sy * (1 - t) + target.y * t };
              }
            }
          }
          // ensure path direction is top -> bottom so the car starts at the top
          if (shifted.length >= 2 && shifted[0].y > shifted[shifted.length - 1].y) shifted.reverse();
          tracePoints = shifted;
          drawTracePreview();

          // convert smoothed polyline to a Catmull-Rom derived Bezier path for a continuous curve
          const d = catmullRomToBezier(tracePoints, 1);
          path.setAttribute('d', d);
          updateRects();
          console.log('map-trail: auto-trace generated', tracePoints.length, 'smoothed points');
        } catch (e) {
          console.error('autoTrace error', e);
        } finally {
          autoBtn.disabled = false;
        }
      }

      function screenToSvg(evt) {
        const pt = svg.createSVGPoint();
        pt.x = evt.clientX;
        pt.y = evt.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        return { x: svgP.x, y: svgP.y };
      }

      svg.addEventListener('click', (ev) => {
        if (!tracing) return;
        try {
          const p = screenToSvg(ev);
          tracePoints.push(p);
          drawTracePreview();
        } catch (e) {
          console.error('trace click error', e);
        }
      });

      autoBtn.addEventListener('click', () => {
        autoTrace();
      });

      // If the current path looks like the placeholder (or is transparent), auto-run trace
      try {
        const currentD = path.getAttribute('d') || '';
        const strokeAttr = path.getAttribute('stroke');
        const looksLikePlaceholder = /M\s*100\s*150/.test(currentD) || (strokeAttr && strokeAttr === 'transparent');
        if (looksLikePlaceholder) {
          // delay slightly to let layout settle and image load
          setTimeout(() => {
            autoTrace();
          }, 300);
        }
      } catch (e) {
        // ignore
      }

      startBtn.addEventListener('click', () => {
        tracing = true;
        tracePoints = [];
        drawTracePreview();
        startBtn.disabled = true;
      });

      clearBtn.addEventListener('click', () => {
        tracePoints = [];
        if (traceLayer) while (traceLayer.firstChild) traceLayer.removeChild(traceLayer.firstChild);
        startBtn.disabled = false;
      });

      finishBtn.addEventListener('click', () => {
        tracing = false;
        startBtn.disabled = false;
        if (tracePoints.length < 2) return;

        // smooth and emit a cleaned cubic Bezier path
        const decimate = 1;
        const dec = [];
        for (let i = 0; i < tracePoints.length; i += decimate) dec.push(tracePoints[i]);
        if (tracePoints.length > 0 && dec[dec.length - 1].y !== tracePoints[tracePoints.length - 1].y) dec.push(tracePoints[tracePoints.length - 1]);
        const smooth = chaikinSmooth(dec, 4);
        // ensure smooth points are ordered top -> bottom
        if (smooth.length >= 2 && smooth[0].y > smooth[smooth.length - 1].y) smooth.reverse();
        // apply vertical shift to manual trace as well
        const shifted = smooth.map(p => ({ x: p.x, y: p.y + VERTICAL_SHIFT }));
        const d = catmullRomToBezier(shifted, 1);
        path.setAttribute('d', d);
        // update measurements
        updateRects();
        // remove preview layer
        if (traceLayer) while (traceLayer.firstChild) traceLayer.removeChild(traceLayer.firstChild);
        tracePoints = [];
        console.log('map-trail: new smooth path created');
      });
    }
  }
}
