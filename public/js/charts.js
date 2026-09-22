/** Tiny dependency-free SVG charts. */

const uid = (() => { let n = 0; return (p = 'c') => `${p}${++n}`; })();

export function sparkline(values = [], { w = 72, h = 26, color = '#14b8a6', fill = true } = {}) {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = w / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [i * step, h - ((v - min) / span) * (h - 4) - 2]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const id = uid('sp');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".28"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${fill ? `<path d="${line} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/>` : ''}
    <path class="spark-line" d="${line}" stroke="${color}" stroke-width="2"/>
    <circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="2.4" fill="${color}"/>
  </svg>`;
}

export function areaChart(series = [], { w = 640, h = 190, color = '#0d9488', color2 = '#0ea5e9', labels = [] } = {}) {
  if (!series.length) return '';
  const padL = 34, padR = 12, padT = 14, padB = 26;
  const max = Math.max(...series, 1) * 1.15;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const step = innerW / Math.max(1, series.length - 1);
  const pts = series.map((v, i) => [padL + i * step, padT + innerH - (v / max) * innerH]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${padT + innerH} L${padL} ${padT + innerH} Z`;
  const id = uid('ar');
  const gridLines = [0, .25, .5, .75, 1].map((f) => {
    const y = padT + innerH - f * innerH;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="#eef3f8" stroke-width="1"/>
      <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#8b9cb0" font-weight="600">${Math.round(max * f)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".26"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color2}"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="url(#${id}s)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map((p, i) => `<g class="pt">
      <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="#fff" stroke="${color2}" stroke-width="2"/>
      <title>${labels[i] || ''}: ${series[i]}</title>
    </g>`).join('')}
    ${labels.map((l, i) => `<text x="${(padL + i * step).toFixed(1)}" y="${h - 7}" text-anchor="middle" font-size="9.5" fill="#8b9cb0" font-weight="600">${l}</text>`).join('')}
  </svg>`;
}

export function donut(segments = [], { size = 148, thickness = 18, center = '' } = {}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map((s) => {
    const len = (s.value / total) * c;
    const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}"
      stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"
      stroke-linecap="butt" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${s.label}: ${s.value}</title></circle>`;
    offset += len;
    return el;
  }).join('');

  const legend = segments.map((s) => `<div class="lg">
    <span class="sw" style="background:${s.color}"></span>${s.label}
    <span class="vl">${s.display ?? s.value}</span></div>`).join('');

  return `<div class="row gap-lg" style="align-items:center;gap:22px;flex-wrap:wrap">
    <div style="position:relative;flex:none">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#eef3f8" stroke-width="${thickness}"/>
        ${arcs}
      </svg>
      ${center ? `<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center">
        <div><div style="font-size:1.3rem;font-weight:800;letter-spacing:-.03em">${center.split('|')[0]}</div>
        <div class="upper" style="color:var(--muted-2);font-size:.58rem">${center.split('|')[1] || ''}</div></div></div>` : ''}
    </div>
    <div class="donut-legend grow">${legend}</div>
  </div>`;
}

export function bars(rows = [], { max, hot = 80 } = {}) {
  const top = max || Math.max(...rows.map((r) => r.value), 1);
  return `<div class="bars">${rows.map((r) => {
    const pct = Math.round((r.value / top) * 100);
    const isHot = r.hot !== undefined ? r.hot : pct >= hot;
    return `<div class="bar-row ${isHot ? 'hot' : ''}">
      <span class="nm truncate" title="${r.label}">${r.label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${r.color || 'var(--grad-brand)'}"></span></span>
      <span class="vl">${r.display ?? r.value}${r.suffix || ''}</span>
    </div>`;
  }).join('')}</div>`;
}

export function ring(score, level = 'medium', { size = 92, label = 'Triage' } = {}) {
  const colors = { critical: '#e11d48', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };
  const color = colors[level] || colors.medium;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const len = (Math.min(100, Math.max(0, score)) / 100) * c;
  return `<div class="score-ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#eef3f8" stroke-width="7"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c}" >
        <animate attributeName="stroke-dashoffset" from="${c}" to="${c - len}" dur=".9s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1"/>
      </circle>
    </svg>
    <div class="mid"><div><div class="num" style="color:${color}">${score}</div><div class="cap">${label}</div></div></div>
  </div>`;
}
