// UI for the Mini Emergency Exit Planner tab: map editing, live recompute,
// step-by-step animation of A* -> Bayes -> MDP -> final plan.
import { SCENARIO, parseMap, plan } from './planner.js';

const $ = (id) => document.getElementById(id);
const CELL = 64;
const cv = $('p-canvas'), ctx = cv.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const fresh = () => { const m = parseMap(SCENARIO.MAP); return { grid: m.grid, start: m.start, exits: m.exits, sensor: m.sensor }; };
let map = fresh();
let res = null;             // last plan result
let view = null;            // what the canvas shows: { expanded:Set, showMain, showDetour, final }
let timers = [];
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const fmt = (x, d = 3) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
const cellTxt = (c) => `(${c[0]},${c[1]})`;

function params() {
  return {
    prior: +$('p-prior').value, pAlarmIfBlocked: +$('p-tp').value, pAlarmIfClear: +$('p-fp').value,
    smokePenalty: +$('p-pen').value, gamma: +$('p-gamma').value,
  };
}
const alarm = () => $('p-reading').value === 'alarm';

// ---------------- canvas ----------------
const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
function drawPath(path, color, width, dash, glow) {
  if (!path || path.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round'; ctx.setLineDash(dash);
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 16; }
  ctx.beginPath();
  path.forEach(([r, c], i) => ctx[i ? 'lineTo' : 'moveTo'](c * CELL + CELL / 2, r * CELL + CELL / 2));
  ctx.stroke(); ctx.restore();
}
function draw() {
  const R = map.grid.length, C = map.grid[0].length, pad = 3;
  cv.width = C * CELL; cv.height = R * CELL;
  ctx.fillStyle = '#04110d'; ctx.fillRect(0, 0, cv.width, cv.height);
  const exp = view?.expanded || new Set();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const x = c * CELL + pad, y = r * CELL + pad, s = CELL - pad * 2;
    if (!map.grid[r][c]) {
      const g = ctx.createLinearGradient(x, y, x + s, y + s);
      g.addColorStop(0, '#b6f5da'); g.addColorStop(0.55, '#5cc9a0'); g.addColorStop(1, '#2a8a68');
      ctx.fillStyle = g; rr(x, y, s, s, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; rr(x + 0.5, y + 0.5, s - 1, s - 1, 11.5); ctx.stroke();
      continue;
    }
    ctx.fillStyle = exp.has(r + ',' + c) ? '#0f5a43' : '#0b2119'; rr(x, y, s, s, 12); ctx.fill();
    if (exp.has(r + ',' + c)) { ctx.strokeStyle = 'rgba(52,245,165,.3)'; ctx.lineWidth = 1; rr(x + 0.5, y + 0.5, s - 1, s - 1, 11.5); ctx.stroke(); }
  }
  // routes
  if (view && res) {
    const chosenIsDetour = res.decision.best === 'Detour';
    if (view.final) {
      drawPath(chosenIsDetour ? res.main.path : res.detour.path, 'rgba(232,255,245,.28)', 3, [4, 7], false);
      drawPath(res.route, '#34f5a5', 7, [], true);
    } else {
      if (view.showMain) drawPath(res.main.path, 'rgba(52,245,165,.75)', 4, [8, 7], false);
      if (view.showDetour && res.sensorOnRoute) drawPath(res.detour.path, 'rgba(125,211,252,.8)', 4, [8, 7], false);
    }
  }
  // exits
  for (const [name, [r, c]] of Object.entries(map.exits)) {
    const x = c * CELL + pad, y = r * CELL + pad, s = CELL - pad * 2;
    ctx.save(); ctx.shadowColor = 'rgba(52,245,165,.8)'; ctx.shadowBlur = 14;
    ctx.strokeStyle = '#34f5a5'; ctx.lineWidth = 2.5; rr(x + 2, y + 2, s - 4, s - 4, 11); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#0a2a20'; rr(x + 2, y + 2, s - 4, s - 4, 11); ctx.fill();
    ctx.fillStyle = '#34f5a5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 20px Inter, sans-serif'; ctx.fillText(name.slice(-1), x + s / 2, y + s / 2 - 6);
    ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.fillText('EXIT', x + s / 2, y + s / 2 + 14);
  }
  // sensor corridor
  if (map.sensor) {
    const [r, c] = map.sensor, cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2, on = alarm();
    const col = on ? '#ff7088' : '#2dd4bf';
    ctx.save(); ctx.fillStyle = on ? '#2a1a1e' : '#0b2a26'; rr(c * CELL + pad, r * CELL + pad, CELL - pad * 2, CELL - pad * 2, 12); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.shadowColor = col; ctx.shadowBlur = on ? 14 : 6;
    for (const rad of [8, 15]) { ctx.beginPath(); ctx.arc(cx, cy + 8, rad, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke(); }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy + 8, 3.5, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = col; ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('SENSOR', cx, cy + 22);
  }
  // person
  const [sr, sc] = map.start, px = sc * CELL + CELL / 2, py = sr * CELL + CELL / 2;
  ctx.save(); ctx.shadowColor = '#7dd3fc'; ctx.shadowBlur = 14; ctx.fillStyle = '#eafff5';
  ctx.beginPath(); ctx.arc(px, py, 17, 0, 7); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.arc(px, py - 5, 5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.roundRect(px - 7, py + 1, 14, 10, 5); ctx.fill();
}

// ---------------- text panels ----------------
function setStep(n, state) { // state: 'idle' | 'active' | 'done'
  const card = $('p-step' + n), pill = document.querySelector(`.pipeline li[data-step="${n}"]`);
  for (const el of [card, pill]) if (el) { el.classList.toggle('active', state === 'active'); el.classList.toggle('done', state === 'done'); el.classList.toggle('idle', state === 'idle'); }
}
function renderSteps() {
  const r = res, b = r.bayes, m = r.mdp, P = r.params;
  const exits = Object.entries(r.exits).map(([n, c]) => `${n} ${cellTxt(c)}`).join(', ');
  const trace = (t) => t.map((s) => `<tr><td>${cellTxt(s.cell)}</td><td>${s.g}</td><td>${s.h}</td><td>${s.f}</td></tr>`).join('');
  $('p-step1-body').innerHTML = `
    <dt>Input</dt><dd>Start ${cellTxt(r.start)} · ${exits} · sensor corridor ${r.sensor ? cellTxt(r.sensor) : '—'}</dd>
    <dt>Key steps</dt><dd>Expand the cell with the lowest <b>f = g + h</b>, where h = Manhattan distance to the nearest exit.
      Fastest search: <b>${r.main.expanded}</b> cells expanded.${r.sensorOnRoute ? ` Detour search (corridor treated as a wall): <b>${r.detour.expanded}</b> cells.` : ''}
      <details><summary>Expansion order (fastest route)</summary><table class="mini"><tr><th>cell</th><th>g</th><th>h</th><th>f</th></tr>${trace(r.main.trace)}</table></details></dd>
    <dt>Output</dt><dd>Fastest: <b>${r.mainExit} · ${r.main.cost} steps</b>${r.sensorOnRoute ? ' (through the corridor)' : ''}.<br>
      ${r.sensorOnRoute ? (r.detour.path ? `Detour: <b>${r.detourExit} · ${r.detour.cost} steps</b>.` : 'Detour: <b>none</b> — the corridor is the only way out.') : 'The sensor corridor is not on this route.'}</dd>
    <dt>Why</dt><dd>A* is optimal with an admissible heuristic and expands far fewer cells than blind search. Its route lengths become the MDP rewards.</dd>`;
  $('p-step2-body').innerHTML = `
    <dt>Input</dt><dd>P(blocked) = ${fmt(b.prior, 2)} · P(alarm | blocked) = ${fmt(P.pAlarmIfBlocked, 2)} · P(alarm | clear) = ${fmt(P.pAlarmIfClear, 2)} · reading: <b>${b.observation}</b></dd>
    <dt>Key steps</dt><dd>P(B | o) = P(o | B)·P(B) / P(o), with B = blocked, C = clear, o = “${b.observation}”:
      <span class="calc">P(o|B)·P(B) = ${fmt(b.likeBlocked, 2)} × ${fmt(b.prior, 2)} = ${fmt(b.jointBlocked, 4)}<br>
      P(o|C)·P(C) = ${fmt(b.likeClear, 2)} × ${fmt(1 - b.prior, 2)} = ${fmt(b.jointClear, 4)}<br>
      P(o) = ${fmt(b.jointBlocked, 4)} + ${fmt(b.jointClear, 4)} = ${fmt(b.evidence, 4)}</span></dd>
    <dt>Output</dt><dd>P(blocked | ${b.observation}) = <b>${fmt(b.posterior, 3)}</b>
      <span class="meter" role="img" aria-label="${Math.round(b.posterior * 100)} percent"><i style="width:${(b.posterior * 100).toFixed(1)}%"></i></span></dd>
    <dt>Why</dt><dd>Bayes’ rule turns one noisy sensor reading into a probability the planner can act on.</dd>`;
  if (!m) {
    $('p-step3-body').innerHTML = `<dt>Output</dt><dd><b>${r.decision.best}</b> — ${r.decision.reason}</dd>
      <dt>Why</dt><dd>The MDP is only needed when there is a real choice between two routes.</dd>`;
  } else {
    const R = m.rewards, q = m.q;
    $('p-step3-body').innerHTML = `
      <dt>Input</dt><dd>States {Clear, Blocked} · actions {Proceed, Detour} · γ = ${P.gamma} · smoke penalty ${P.smokePenalty}. Rewards from A* (negative steps):
        <table class="mini"><tr><th></th><th>Proceed</th><th>Detour</th></tr>
        <tr><td>Clear</td><td>${R['Clear|Proceed']}</td><td>${R['Clear|Detour']}</td></tr>
        <tr><td>Blocked</td><td>${R['Blocked|Proceed']}</td><td>${R['Blocked|Detour']}</td></tr></table></dd>
      <dt>Key steps</dt><dd>One Bellman update: Q(s,a) = R(s,a) + γ Σ T(s′|s,a)·V₀(s′), V₀(s) = maxₐ R(s,a)
        <table class="mini"><tr><th>Q(s,a)</th><th>Proceed</th><th>Detour</th></tr>
        <tr><td>Clear</td><td>${fmt(q['Clear|Proceed'])}</td><td>${fmt(q['Clear|Detour'])}</td></tr>
        <tr><td>Blocked</td><td>${fmt(q['Blocked|Proceed'])}</td><td>${fmt(q['Blocked|Detour'])}</td></tr>
        <tr class="hl"><td>b = ${fmt(b.posterior, 3)}</td><td>${fmt(m.qBelief.Proceed)}</td><td>${fmt(m.qBelief.Detour)}</td></tr></table>
        ${m.threshold != null ? `Detour whenever P(blocked) &gt; <b>${fmt(m.threshold, 3)}</b>.` : ''}</dd>
      <dt>Output</dt><dd><b>${m.best}</b></dd>
      <dt>Why</dt><dd>The MDP weighs the cost of each action in each corridor state by how likely that state is.</dd>`;
  }
}
function renderDecision() {
  const r = res, d = $('p-decision'), m = r.mdp;
  const why = m && m.threshold != null
    ? (r.decision.best === 'Detour'
      ? `P(blocked) = ${fmt(r.bayes.posterior, 2)} is above the ${fmt(m.threshold, 3)} threshold, so ${r.detour.cost - r.main.cost} extra steps are worth avoiding the smoke.`
      : `P(blocked) = ${fmt(r.bayes.posterior, 3)} is below the ${fmt(m.threshold, 3)} threshold, so the fastest route is the better bet.`)
    : r.decision.reason;
  d.className = 'decision ' + (r.decision.best === 'Detour' ? 'detour' : 'proceed');
  d.innerHTML = `<span class="lbl">Recommended action</span><strong>${r.decision.best.toUpperCase()}</strong>
    <span class="route">→ ${r.routeExit} · ${r.routeCost} steps</span><p>${why}</p>`;
}
function showError(msg) {
  res = null; view = null; draw();
  $('p-decision').className = 'decision err';
  $('p-decision').innerHTML = `<span class="lbl">No plan</span><p>${msg}</p>`;
  ['p-step1-body', 'p-step2-body', 'p-step3-body'].forEach((id) => { $(id).innerHTML = ''; });
}

// ---------------- compute / animate ----------------
function stop() { timers.forEach(clearTimeout); timers = []; $('p-run').disabled = false; }
function compute() {
  try { res = plan(map, alarm(), params()); } catch (e) { showError(e.message); return false; }
  return true;
}
function showAll() {
  stop();
  if (!compute()) return;
  view = { expanded: new Set(), final: true };
  renderSteps(); renderDecision(); [1, 2, 3, 4].forEach((n) => setStep(n, 'done')); draw();
}
function runAnimated() {
  stop();
  if (!compute()) return;
  if (reduceMotion) { showAll(); return; }
  $('p-run').disabled = true;
  renderSteps(); renderDecision();
  [1, 2, 3, 4].forEach((n) => setStep(n, 'idle'));
  $('p-decision').classList.add('pending');
  view = { expanded: new Set(), showMain: false, showDetour: false, final: false };
  let t = 0; const at = (ms, fn) => timers.push(setTimeout(fn, (t += ms)));
  at(0, () => { setStep(1, 'active'); draw(); });
  res.main.trace.forEach((s) => at(170, () => { view.expanded.add(s.cell.join(',')); draw(); }));
  at(250, () => { view.showMain = true; draw(); });
  if (res.sensorOnRoute && res.detour.path) {
    at(450, () => { view.expanded = new Set(); draw(); });
    res.detour.trace.forEach((s) => at(110, () => { view.expanded.add(s.cell.join(',')); draw(); }));
    at(250, () => { view.showDetour = true; draw(); });
  }
  at(900, () => { setStep(1, 'done'); setStep(2, 'active'); });
  at(1600, () => { setStep(2, 'done'); setStep(3, 'active'); });
  at(1700, () => {
    setStep(3, 'done'); setStep(4, 'done');
    view = { expanded: new Set(), final: true }; draw();
    $('p-decision').classList.remove('pending'); $('p-run').disabled = false;
  });
}

// ---------------- events ----------------
['p-prior', 'p-tp', 'p-fp', 'p-pen', 'p-gamma'].forEach((id) => $(id).addEventListener('input', showAll));
$('p-reading').addEventListener('change', showAll);
$('p-run').addEventListener('click', runAnimated);
$('p-reset').addEventListener('click', () => {
  map = fresh();
  for (const [id, v] of [['p-prior', SCENARIO.PRIOR_BLOCKED], ['p-tp', SCENARIO.P_ALARM_IF_BLOCKED], ['p-fp', SCENARIO.P_ALARM_IF_CLEAR], ['p-pen', SCENARIO.SMOKE_PENALTY], ['p-gamma', SCENARIO.GAMMA]]) {
    $(id).value = v; $(id).dispatchEvent(new Event('input'));
  }
  showAll();
});
cv.addEventListener('pointerdown', (e) => {
  const rect = cv.getBoundingClientRect(), k = cv.width / rect.width;
  const r = Math.floor(((e.clientY - rect.top) * k) / CELL), c = Math.floor(((e.clientX - rect.left) * k) / CELL);
  if (r < 0 || c < 0 || r >= map.grid.length || c >= map.grid[0].length) return;
  const cell = [r, c], isExit = Object.values(map.exits).some((x) => same(x, cell)), mode = $('p-mode').value;
  if (mode === 'wall') {
    if (isExit || same(cell, map.start) || same(cell, map.sensor)) return;
    map.grid[r][c] = map.grid[r][c] ? 0 : 1;
  } else if (mode === 'start') {
    if (!map.grid[r][c] || isExit || same(cell, map.sensor)) return;
    map.start = cell;
  } else if (mode === 'sensor') {
    if (!map.grid[r][c] || isExit || same(cell, map.start)) return;
    map.sensor = cell;
  }
  showAll();
});

showAll();
