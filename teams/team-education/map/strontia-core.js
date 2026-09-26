// Team addition (teams/team-education): drawing primitives for the Strontia Springs depth pictures,
// shared by design-storm-water-system-3d.html (the map panel) and strontia.html (the pop-out).
// Data: strontia-profile.json (analysis/build_profile_json.py) and strontia-lessons.json
// (analysis/build_lessons.py). A classic script: everything here is a page global.

// One-hue sequential ramp for a dark panel: low values recede toward the surface, high are light.
const PROFILE_RAMP = ["#0d366b", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"];

function hexRgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
const PROFILE_RGB = PROFILE_RAMP.map(hexRgb);

function rampColor(f) {
  f = Math.max(0, Math.min(1, f)) * (PROFILE_RGB.length - 1);
  const i = Math.min(Math.floor(f), PROFILE_RGB.length - 2), t = f - i;
  return PROFILE_RGB[i].map((c, k) => Math.round(c + t * (PROFILE_RGB[i + 1][k] - c)));
}

function profileScale(meta, dom) {
  const [lo, hi] = dom;
  if (meta.log) {
    const a = Math.log10(lo), b = Math.log10(hi);
    return (v) => (Math.log10(Math.max(v, lo)) - a) / (b - a);
  }
  return (v) => (v - lo) / (hi - lo);
}

function profileTime(view, i) {
  return new Date(new Date(view.start).getTime() + i * view.step_h * 3600000);
}

function fmtWhen(d, withTime) {
  const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return withTime ? `${day} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : day;
}

function fmtVal(v, meta) {
  if (v === null || v === undefined) return "no reading";
  const d = meta.units === "µS/cm" ? 0 : Math.abs(v) < 10 ? 2 : 1;
  return `${v.toFixed(d)} ${meta.units}`;
}

// Axis label for strip charts (same rule as the map's formatValue).
function stripValue(v) {
  return Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : (Math.round(v * 100) / 100).toString();
}

function sizeCanvas(c) {
  const ratio = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  c.width = w * ratio; c.height = h * ratio;
  const g = c.getContext("2d"); g.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { g, w, h };
}

const PROF_PAD = { left: 30, right: 6, top: 4, bottom: 16 };
const AXIS_INK = "rgba(184,192,200,0.95)";

// x position of a time on any canvas that shares the heatmaps' time axis
function viewX(view, w) {
  const t0 = profileTime(view, 0).getTime(), t1 = profileTime(view, view.n).getTime();
  const X = (t) => PROF_PAD.left + (t - t0) / (t1 - t0) * (w - PROF_PAD.left - PROF_PAD.right);
  return { X, t0, t1 };
}

// Heatmap image at data resolution (one pixel per time step and depth), cached per view/parameter.
const heatImages = new Map();
function heatImage(P, viewKey, key) {
  const id = viewKey + "/" + key;
  if (heatImages.has(id)) return heatImages.get(id);
  const view = P.views[viewKey], meta = P.params[key], data = view.params[key];
  const nT = view.n, nZ = P.depths.length;
  const scale = profileScale(meta, data.domain);
  const off = document.createElement("canvas");
  off.width = nT; off.height = nZ;
  const og = off.getContext("2d"), img = og.createImageData(nT, nZ);
  for (let i = 0; i < nT; i++) for (let j = 0; j < nZ; j++) {
    const v = data.values[i * nZ + j], p = (j * nT + i) * 4;
    if (v === null) { img.data[p + 3] = 0; continue; }
    const [r, gg, b] = rampColor(scale(v));
    img.data[p] = r; img.data[p + 1] = gg; img.data[p + 2] = b; img.data[p + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  heatImages.set(id, off);
  return off;
}

// Draw one depth-by-time heatmap with its axes, servicing lines and (storm view) gage peak.
// Returns the geometry the caller needs for hover, highlights and linked crosshairs.
function drawHeat(canvas, P, viewKey, key, opts = {}) {
  const view = P.views[viewKey];
  const nT = view.n, nZ = P.depths.length;
  const storm = viewKey === "storm";
  const off = heatImage(P, viewKey, key);
  const { g, w, h } = sizeCanvas(canvas);
  const { X, t0, t1 } = viewX(view, w);
  const pw = w - PROF_PAD.left - PROF_PAD.right, ph = h - PROF_PAD.top - PROF_PAD.bottom;
  // "no reading" hatch underneath
  g.save(); g.beginPath(); g.rect(PROF_PAD.left, PROF_PAD.top, pw, ph); g.clip();
  g.strokeStyle = "rgba(255,255,255,0.10)"; g.lineWidth = 1;
  for (let x = -ph; x < pw; x += 5) { g.beginPath(); g.moveTo(PROF_PAD.left + x, PROF_PAD.top + ph); g.lineTo(PROF_PAD.left + x + ph, PROF_PAD.top); g.stroke(); }
  g.restore();
  g.imageSmoothingEnabled = false;
  g.drawImage(off, PROF_PAD.left, PROF_PAD.top, pw, ph);
  // depth axis
  g.fillStyle = AXIS_INK; g.font = "10px -apple-system, sans-serif"; g.textAlign = "right";
  const Y = (z) => PROF_PAD.top + (z - (P.depths[0] - 0.5)) / nZ * ph;
  for (const z of [1, 10, 20, 30, 40]) g.fillText(z + " m", PROF_PAD.left - 4, Y(z) + 3);
  timeAxis(g, X, t0, t1, h, storm);
  // sensor servicing and storm marks
  g.setLineDash([2, 3]); g.strokeStyle = "rgba(255,255,255,0.45)";
  for (const s of P.service_events) {
    const t = new Date(s).getTime();
    if (t > t0 && t < t1) { g.beginPath(); g.moveTo(X(t), PROF_PAD.top); g.lineTo(X(t), PROF_PAD.top + ph); g.stroke(); }
  }
  g.setLineDash([]);
  if (storm) markGagePeak(g, X, PROF_PAD.top, PROF_PAD.top + ph, true, P.marks.gage_peak);
  const geo = { g, w, h, X, Y, t0, t1, pw, ph, nT, nZ, view, P, key,
    // data cell under a canvas point, or null
    pick(px, py) {
      const i = Math.floor((px - PROF_PAD.left) / pw * nT), j = Math.floor((py - PROF_PAD.top) / ph * nZ);
      return i < 0 || i >= nT || j < 0 || j >= nZ ? null : { i, j };
    },
  };
  if (opts.highlight) drawHighlight(geo, opts.highlight);
  if (opts.points) drawPoints(geo, opts.points);
  return geo;
}

// A rectangle over a time range and a depth range (whole-metre rows, inclusive).
function drawHighlight(geo, hl) {
  const { g, X, Y } = geo;
  const x0 = Math.max(X(new Date(hl.t0).getTime()), PROF_PAD.left);
  const x1 = Math.min(X(new Date(hl.t1).getTime()), PROF_PAD.left + geo.pw);
  const y0 = Math.max(Y(hl.z0 - 0.5), PROF_PAD.top), y1 = Math.min(Y(hl.z1 + 0.5), PROF_PAD.top + geo.ph);
  g.save();
  g.lineWidth = 3; g.strokeStyle = "rgba(16,20,24,0.9)"; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  g.lineWidth = 2; g.strokeStyle = "#ffd166"; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  if (hl.label) {
    g.font = "600 11px -apple-system, sans-serif";
    const tw = g.measureText(hl.label).width;
    let lx = x0, ly = y0 - 4;
    if (ly < 12) ly = y1 + 13;                                   // no room above: label below the box
    if (ly > geo.h - PROF_PAD.bottom) ly = y0 + 14;              // nor below: inside, top
    lx = Math.min(Math.max(lx, PROF_PAD.left), geo.w - PROF_PAD.right - tw - 6);
    g.fillStyle = "rgba(16,20,24,0.85)"; g.fillRect(lx - 1, ly - 11, tw + 8, 14);
    g.fillStyle = "#ffd166"; g.textAlign = "left"; g.fillText(hl.label, lx + 3, ly);
  }
  g.restore();
}

// Dots at [time, depth] positions, joined by a thin line (e.g. the muddiest depth each day).
function drawPoints(geo, pts) {
  const { g, X, Y } = geo;
  const xy = pts.map(([t, z]) => [X(new Date(t).getTime()), Y(z)]);
  g.save();
  g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1.5; g.beginPath();
  xy.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  for (const [x, y] of xy) {
    g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fillStyle = "#101418"; g.fill();
    g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fillStyle = "#ffffff"; g.fill();
  }
  g.restore();
}

function timeAxis(g, X, t0, t1, h, storm) {
  g.fillStyle = AXIS_INK; g.textAlign = "center";
  const d = new Date(t0); d.setHours(0, 0, 0, 0);
  if (storm) {
    for (d.setDate(d.getDate() + 1); d.getTime() < t1; d.setDate(d.getDate() + 1))
      if (d.getDate() % 2 === 0) g.fillText(fmtWhen(d, false), X(d.getTime()), h - 3);
  } else {
    d.setDate(1);
    for (d.setMonth(d.getMonth() + 1); d.getTime() < t1; d.setMonth(d.getMonth() + 1))
      g.fillText(d.toLocaleDateString(undefined, { month: "short" }), X(d.getTime()), h - 3);
  }
}

function markGagePeak(g, X, top, bottom, label, peakIso) {
  const t = new Date(peakIso).getTime();
  g.setLineDash([5, 3]); g.strokeStyle = "rgba(255,209,102,0.9)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(X(t), top); g.lineTo(X(t), bottom); g.stroke(); g.setLineDash([]);
  if (label) { g.fillStyle = "rgba(255,209,102,0.95)"; g.textAlign = "left"; g.fillText("gage peak", X(t) + 3, top + 10); }
}

function drawStrip(canvas, pts, X, logY, color, label, peakIso) {
  const { g, w, h } = sizeCanvas(canvas);
  const top = 6, bottom = h - 14;
  const vals = pts.map((p) => p[1]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const f = logY ? (v) => Math.log10(v) : (v) => v;
  if (!logY) { const pad = (hi - lo) * 0.15 || 0.1; lo -= pad; hi += pad; }
  const Y = (v) => bottom - (f(v) - f(lo)) / (f(hi) - f(lo) || 1) * (bottom - top);
  g.strokeStyle = "rgba(255,255,255,0.15)"; g.beginPath(); g.moveTo(PROF_PAD.left, bottom); g.lineTo(w - PROF_PAD.right, bottom); g.stroke();
  g.strokeStyle = color; g.lineWidth = 2; g.lineJoin = "round"; g.beginPath();
  pts.forEach((p, k) => { const x = X(p[0]), y = Y(p[1]); k ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  if (!logY) { g.fillStyle = color; pts.forEach((p) => { g.beginPath(); g.arc(X(p[0]), Y(p[1]), 2.5, 0, 7); g.fill(); }); }
  g.fillStyle = AXIS_INK; g.font = "10px -apple-system, sans-serif"; g.textAlign = "right";
  g.fillText(stripValue(Math.max(...vals)), PROF_PAD.left - 4, Y(Math.max(...vals)) + 4);
  g.fillText(stripValue(Math.min(...vals)), PROF_PAD.left - 4, Y(Math.min(...vals)) + 4);
  markGagePeak(g, X, top, bottom, false, peakIso);
  if (label) { g.textAlign = "left"; g.fillStyle = "rgba(184,192,200,0.8)"; g.fillText(label, PROF_PAD.left + 4, h - 2); }
  return { g, w, h, top, bottom, Y };
}

function gagePoints(P) { return P.gage.turb.map(([t, v]) => [new Date(t).getTime(), v]); }
function tocPoints(P) { return P.plant_toc.map(([d, v]) => [new Date(d + "T12:00:00").getTime(), v]); }

function drawGageStrip(canvas, P, X) {
  return drawStrip(canvas, gagePoints(P), X, true, "#d95926",
    "15-minute readings exist for Aug 14 12:00 to Aug 15 18:00 only", P.marks.gage_peak);
}

function drawTocStrip(canvas, P, X) {
  return drawStrip(canvas, tocPoints(P), X, false, "#199e70", "", P.marks.gage_peak);
}

// ---- small line charts (lessons): one y axis, daily points, crosshair readout ------------------
const LINE_PAD = { left: 38, right: 10, top: 8, bottom: 18 };

function niceTicks(lo, hi, n = 4) {
  const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

// spec: { title, units, x: ["YYYY-MM-DD"...], series: [{ name, color, values }] }
function drawLineChart(canvas, spec, hover = -1) {
  const { g, w, h } = sizeCanvas(canvas);
  const xs = spec.x.map((d) => new Date(d + "T12:00:00").getTime());
  const all = spec.series.flatMap((s) => s.values).filter((v) => v !== null);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (spec.y) { [lo, hi] = spec.y; }                     // fixed axis range from the lesson JSON
  else { const pad = (hi - lo) * 0.08 || 0.5; lo -= pad; hi += pad; }
  const suffix = spec.y_suffix || "";
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const pw = w - LINE_PAD.left - LINE_PAD.right, ph = h - LINE_PAD.top - LINE_PAD.bottom;
  const X = (t) => LINE_PAD.left + (t - x0) / (x1 - x0 || 1) * pw;
  const Y = (v) => LINE_PAD.top + (hi - v) / (hi - lo) * ph;
  g.font = "10px -apple-system, sans-serif";
  // recessive grid and y labels
  for (const v of niceTicks(lo, hi, spec.y ? 5 : 4)) {
    g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(LINE_PAD.left, Y(v)); g.lineTo(w - LINE_PAD.right, Y(v)); g.stroke();
    g.fillStyle = AXIS_INK; g.textAlign = "right"; g.fillText(stripValue(v) + suffix, LINE_PAD.left - 5, Y(v) + 3);
  }
  // x labels: months for a season, every other day for a short window
  g.fillStyle = AXIS_INK; g.textAlign = "center";
  const days = (x1 - x0) / 864e5;
  const d = new Date(x0); d.setHours(12, 0, 0, 0);
  if (days > 40) {
    d.setDate(1);
    for (d.setMonth(d.getMonth() + 1); d.getTime() <= x1; d.setMonth(d.getMonth() + 1))
      g.fillText(d.toLocaleDateString(undefined, { month: "short" }), X(d.getTime()), h - 4);
  } else {
    const every = days > 14 ? 4 : w < 360 ? 3 : 2;
    for (let k = 0; d.getTime() <= x1; d.setDate(d.getDate() + 1), k++)
      if (k % every === 0) g.fillText(fmtWhen(d, false), X(d.getTime()), h - 4);
  }
  // lines, 2px, gaps where a value is missing; a marker when a point stands alone
  for (const s of spec.series) {
    g.strokeStyle = s.color; g.lineWidth = 2; g.lineJoin = "round"; g.lineCap = "round";
    g.beginPath();
    let on = false;
    s.values.forEach((v, k) => {
      if (v === null) { on = false; return; }
      on ? g.lineTo(X(xs[k]), Y(v)) : g.moveTo(X(xs[k]), Y(v)); on = true;
    });
    g.stroke();
    g.fillStyle = s.color;
    s.values.forEach((v, k) => {
      const alone = (s.values[k - 1] ?? null) === null && (s.values[k + 1] ?? null) === null;
      if (v !== null && (xs.length <= 20 || alone)) { g.beginPath(); g.arc(X(xs[k]), Y(v), alone && xs.length > 20 ? 2 : 3, 0, 7); g.fill(); }
    });
  }
  // crosshair
  if (hover >= 0) {
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(X(xs[hover]), LINE_PAD.top); g.lineTo(X(xs[hover]), LINE_PAD.top + ph); g.stroke();
    for (const s of spec.series) {
      const v = s.values[hover];
      if (v === null) continue;
      g.beginPath(); g.arc(X(xs[hover]), Y(v), 4.5, 0, 7); g.fillStyle = "#101418"; g.fill();
      g.beginPath(); g.arc(X(xs[hover]), Y(v), 3.5, 0, 7); g.fillStyle = s.color; g.fill();
    }
  }
  return {
    // nearest x index to a canvas x position
    nearest(px) {
      let best = 0;
      xs.forEach((t, k) => { if (Math.abs(X(t) - px) < Math.abs(X(xs[best]) - px)) best = k; });
      return best;
    },
  };
}


// ---- depth profiles (lessons): value across, depth down (surface at the top), one x axis --------
// spec: { title, units, depths: [m...], series: [{ name, color, values }], ref?: { value, label } }
const PROF_CHART_PAD = { left: 34, right: 12, top: 8, bottom: 30 };

function drawProfileChart(canvas, spec, hover = -1) {
  const { g, w, h } = sizeCanvas(canvas);
  const P = PROF_CHART_PAD, zs = spec.depths;
  const all = spec.series.flatMap((s) => s.values).filter((v) => v !== null);
  if (spec.ref) all.push(spec.ref.value);
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 0.5; lo -= pad; hi += pad;
  const pw = w - P.left - P.right, ph = h - P.top - P.bottom;
  const z0 = 0, z1 = Math.ceil(zs[zs.length - 1] / 10) * 10;
  const X = (v) => P.left + (v - lo) / (hi - lo) * pw;
  const Y = (z) => P.top + (z - z0) / (z1 - z0) * ph;
  g.font = "10px -apple-system, sans-serif";
  // recessive grid: value ticks across the bottom, depth labels down the left
  for (const v of niceTicks(lo, hi, w < 300 ? 3 : 4)) {
    g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(X(v), P.top); g.lineTo(X(v), P.top + ph); g.stroke();
    g.fillStyle = AXIS_INK; g.textAlign = "center"; g.fillText(stripValue(v), X(v), P.top + ph + 12);
  }
  g.textAlign = "center"; g.fillText(spec.units, P.left + pw / 2, h - 3);
  g.textAlign = "right";
  for (let z = 0; z <= z1; z += 10) {
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.beginPath(); g.moveTo(P.left, Y(z)); g.lineTo(P.left + pw, Y(z)); g.stroke();
    g.fillText(z + " m", P.left - 4, Y(z) + 3);
  }
  // reference value (e.g. the river gage): dashed vertical line, labelled at the bottom
  if (spec.ref) {
    const x = X(spec.ref.value);
    g.setLineDash([5, 3]); g.strokeStyle = "rgba(255,209,102,0.9)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, P.top); g.lineTo(x, P.top + ph); g.stroke(); g.setLineDash([]);
  }
  for (const s of spec.series) {
    g.strokeStyle = s.color; g.lineWidth = 2; g.lineJoin = "round"; g.lineCap = "round";
    g.beginPath();
    let on = false;
    s.values.forEach((v, k) => {
      if (v === null) { on = false; return; }
      on ? g.lineTo(X(v), Y(zs[k])) : g.moveTo(X(v), Y(zs[k])); on = true;
    });
    g.stroke();
  }
  if (hover >= 0) {
    const y = Y(zs[hover]);
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(P.left, y); g.lineTo(P.left + pw, y); g.stroke();
    for (const s of spec.series) {
      const v = s.values[hover];
      if (v === null) continue;
      g.beginPath(); g.arc(X(v), y, 4.5, 0, 7); g.fillStyle = "#101418"; g.fill();
      g.beginPath(); g.arc(X(v), y, 3.5, 0, 7); g.fillStyle = s.color; g.fill();
    }
  }
  return {
    // nearest depth index to a canvas y position
    nearest(py) {
      let best = 0;
      zs.forEach((z, k) => { if (Math.abs(Y(z) - py) < Math.abs(Y(zs[best]) - py)) best = k; });
      return best;
    },
  };
}
