import { solve, makeGrid } from './search.js';
import { hillClimbing } from './localsearch.js';
import { aiMove, minimax, alphaBeta, winner, isFull } from './adversarial.js';

const $ = (id) => document.getElementById(id);
const say = (el, text, kind = '') => { el.textContent = text; el.className = 'msg ' + kind; };
const NAMES = { astar: 'A*', ucs: 'UCS', bfs: 'BFS', dfs: 'DFS' };

// ---------- Tabs (deep links: #search, #queens, #ttt) ----------
function showTab(name) {
  const tabs = document.querySelectorAll('nav button');
  if (![...tabs].some((b) => b.dataset.tab === name)) name = 'search';
  tabs.forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== 'tab-' + name; });
}
document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
  showTab(b.dataset.tab); history.replaceState(null, '', '#' + b.dataset.tab);
}));

// ======================= Week 2: Search =======================
const S = { cells: makeGrid(15, 25), start: [7, 3], goal: [7, 21], vis: new Map(), path: [], timer: 0, painting: false };
const sc = $('s-canvas'), sctx = sc.getContext('2d');
const CELL = 26;

// ---------- UI helpers: segmented controls & iOS sliders ----------
document.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  $(seg.dataset.for).value = b.dataset.v;
}));
function syncSlider(inp) {
  const p = ((inp.value - inp.min) / (inp.max - inp.min)) * 100;
  inp.style.setProperty('--p', p + '%');
  const out = inp.closest('label')?.querySelector('output'); if (out) out.textContent = inp.value;
}
document.querySelectorAll('input[type=range]').forEach((r) => { syncSlider(r); r.addEventListener('input', () => syncSlider(r)); });

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

function sDraw() {
  const R = S.cells.length, C = S.cells[0].length;
  sc.width = C * CELL; sc.height = R * CELL;
  sctx.fillStyle = '#04110d'; sctx.fillRect(0, 0, sc.width, sc.height);
  const pad = 1.5;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const w = S.cells[r][c], x = c * CELL + pad, y = r * CELL + pad, s = CELL - pad * 2;
    if (w === 0) { // wall: emerald glass block
      const g = sctx.createLinearGradient(x, y, x + s, y + s);
      g.addColorStop(0, '#b6f5da'); g.addColorStop(0.55, '#5cc9a0'); g.addColorStop(1, '#2a8a68');
      sctx.fillStyle = g;
    } else sctx.fillStyle = S.vis.has(r * C + c) ? '#0f5a43' : w > 1 ? `hsl(172 ${46 + w * 3}% ${12 + w * 1.9}%)` : '#0b2119';
    rr(sctx, x, y, s, s, 7); sctx.fill();
    if (w === 0) { sctx.strokeStyle = 'rgba(255,255,255,.35)'; sctx.lineWidth = 1; rr(sctx, x + 0.5, y + 0.5, s - 1, s - 1, 6.5); sctx.stroke(); }
    else if (S.vis.has(r * C + c)) { sctx.strokeStyle = 'rgba(52,245,165,.28)'; sctx.lineWidth = 1; rr(sctx, x + 0.5, y + 0.5, s - 1, s - 1, 6.5); sctx.stroke(); }
    if (w > 1) { sctx.fillStyle = '#9ff7d3'; sctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle'; sctx.fillText(w, x + s / 2, y + s / 2 + 1); }
  }
  if (S.path.length > 1) {
    sctx.strokeStyle = '#34f5a5'; sctx.lineWidth = CELL * 0.28; sctx.lineCap = sctx.lineJoin = 'round';
    sctx.shadowColor = 'rgba(52,245,165,.85)'; sctx.shadowBlur = 14;
    sctx.beginPath();
    S.path.forEach(([r, c], i) => sctx[i ? 'lineTo' : 'moveTo'](c * CELL + CELL / 2, r * CELL + CELL / 2));
    sctx.stroke(); sctx.shadowBlur = 0;
  }
  for (const [p, col] of [[S.start, '#7dd3fc'], [S.goal, '#f5c451']]) {
    const cx = p[1] * CELL + CELL / 2, cy = p[0] * CELL + CELL / 2;
    sctx.fillStyle = '#eafff5'; sctx.shadowColor = col; sctx.shadowBlur = 12;
    sctx.beginPath(); sctx.arc(cx, cy, CELL / 2 - 2, 0, 7); sctx.fill(); sctx.shadowBlur = 0;
    sctx.fillStyle = col; sctx.beginPath(); sctx.arc(cx, cy, CELL / 2 - 6, 0, 7); sctx.fill();
  }
}

function sCell(e) {
  const rect = sc.getBoundingClientRect(), k = sc.width / rect.width;
  return [Math.floor(((e.clientY - rect.top) * k) / CELL), Math.floor(((e.clientX - rect.left) * k) / CELL)];
}
function sPaint(e) {
  const [r, c] = sCell(e);
  if (r < 0 || c < 0 || r >= S.cells.length || c >= S.cells[0].length) return;
  const mode = $('s-mode').value, same = (p) => p[0] === r && p[1] === c;
  sStop();
  if (mode === 'start') { if (S.cells[r][c] && !same(S.goal)) S.start = [r, c]; }
  else if (mode === 'goal') { if (S.cells[r][c] && !same(S.start)) S.goal = [r, c]; }
  else if (!same(S.start) && !same(S.goal)) S.cells[r][c] = mode === 'wall' ? 0 : mode === 'w5' ? 5 : mode === 'w9' ? 9 : 1;
  S.vis.clear(); S.path = []; sDraw();
}
sc.addEventListener('pointerdown', (e) => { S.painting = true; sPaint(e); });
sc.addEventListener('pointermove', (e) => { if (S.painting && !/start|goal/.test($('s-mode').value)) sPaint(e); });
addEventListener('pointerup', () => { S.painting = false; });

function sStop() { clearTimeout(S.timer); S.timer = 0; }
function sReset() { sStop(); S.vis.clear(); S.path = []; $('s-result').innerHTML = ''; $('s-explain').textContent = ''; }

const sOpts = () => [$('s-algo').value, S.cells, S.start, S.goal, $('s-heur').value];

$('s-run').onclick = () => {
  sReset();
  let res;
  try { res = solve(...sOpts()); } catch (e) { say($('s-msg'), e.message, 'err'); sDraw(); return; }
  const C = S.cells[0].length, per = Math.max(1, Math.round(($('s-speed').value / 100) ** 2 * 20));
  let i = 0;
  say($('s-msg'), 'Searching…');
  const tick = () => {
    for (let k = 0; k < per && i < res.visited.length; k++, i++) S.vis.set(res.visited[i][0] * C + res.visited[i][1], 1);
    sDraw();
    if (i < res.visited.length) { S.timer = setTimeout(tick, 16); return; }
    if (res.found) { S.path = res.path; sDraw(); say($('s-msg'), `Path found: ${res.path.length - 1} steps, cost ${res.cost}.`, 'ok'); }
    else say($('s-msg'), 'No path: walls separate the start from the goal.', 'err');
    showResult([[sOpts()[0], res]]);
  };
  tick();
};

$('s-compare').onclick = () => {
  sReset();
  try {
    const rows = ['bfs', 'dfs', 'ucs', 'astar'].map((a) => [a, solve(a, S.cells, S.start, S.goal, $('s-heur').value)]);
    const best = rows.find((r) => r[0] === 'astar')[1];
    if (best.found) S.path = best.path;
    S.vis.clear(); sDraw(); showResult(rows);
    say($('s-msg'), best.found ? 'Comparison ready (the highlighted line is the A* path).' : 'No path.', best.found ? 'ok' : 'err');
  } catch (e) { say($('s-msg'), e.message, 'err'); }
};

function showResult(rows) {
  $('s-result').innerHTML = '<table><tr><th>Algorithm</th><th>Found</th><th>Cost</th><th>Nodes expanded</th><th>Time, ms</th></tr>' +
    rows.map(([a, r]) => `<tr><td>${NAMES[a]}</td><td>${r.found ? 'yes' : 'no'}</td><td>${r.cost ?? '—'}</td><td>${r.expanded}</td><td>${r.ms.toFixed(2)}</td></tr>`).join('') + '</table>';
  $('s-explain').innerHTML = '<b>Explanation:</b> BFS minimizes the number of steps but ignores weights; DFS finds a path, but not an optimal one; ' +
    'UCS is optimal with respect to the accumulated cost (g); A* is guided by f = g + h, is optimal with an admissible heuristic and expands fewer nodes than UCS.';
}

$('s-resize').onclick = () => {
  try { S.cells = makeGrid(+$('s-rows').value, +$('s-cols').value); } catch (e) { say($('s-msg'), e.message, 'err'); return; }
  S.start = [0, 0]; S.goal = [S.cells.length - 1, S.cells[0].length - 1];
  sReset(); say($('s-msg'), ''); sDraw();
};
$('s-clear').onclick = () => { S.cells = S.cells.map((r) => r.map(() => 1)); sReset(); say($('s-msg'), ''); sDraw(); };
$('s-random').onclick = () => {
  sReset(); say($('s-msg'), '');
  S.cells = S.cells.map((row, r) => row.map((_, c) => ((r === S.start[0] && c === S.start[1]) || (r === S.goal[0] && c === S.goal[1]) ? 1 : Math.random() < 0.25 ? 0 : 1)));
  sDraw();
};
sDraw();

// ======================= Week 3: Hill Climbing =======================
const Q = { res: null, i: 0, timer: 0 };
const qc = $('q-canvas'), qctx = qc.getContext('2d');

function qDraw() {
  const step = Q.res?.steps[Q.i];
  const n = step ? step.state.length : +$('q-n').value || 8, size = Math.min(520, n * 40), cs = size / n;
  qc.width = qc.height = size;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    qctx.fillStyle = (r + c) % 2 ? '#0f3328' : '#071812'; qctx.fillRect(c * cs, r * cs, cs, cs);
  }
  if (!step) return;
  const crown = new Path2D('M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z');
  step.state.forEach((row, c) => {
    const attacked = step.state.some((r2, c2) => c2 !== c && (r2 === row || Math.abs(r2 - row) === Math.abs(c2 - c)));
    qctx.save();
    qctx.translate(c * cs + cs * 0.15, row * cs + cs * 0.15); qctx.scale((cs * 0.7) / 24, (cs * 0.7) / 24);
    qctx.fillStyle = attacked ? '#ff7088' : '#34f5a5'; qctx.shadowColor = attacked ? 'rgba(255,112,136,.8)' : 'rgba(52,245,165,.85)'; qctx.shadowBlur = 10;
    qctx.fill(crown); qctx.restore();
  });
  $('q-info').innerHTML = `<b>Step ${Q.i}/${Q.res.steps.length - 1}</b> · restart #${step.restart} · conflicts h = <b>${step.h}</b>` +
    (Q.i === Q.res.steps.length - 1 ? (Q.res.solved ? ' · <b>solution found</b>' : ' · no solution (local minimum)') : '') +
    '<br>At every step Hill Climbing moves the queen that reduces h the most; at a local minimum it stops and starts again from a random state (random restart).';
}
$('q-run').onclick = () => {
  clearInterval(Q.timer);
  try {
    Q.res = hillClimbing(+$('q-n').value, { maxRestarts: +$('q-restarts').value, seed: +$('q-seed').value });
  } catch (e) { say($('q-msg'), e.message, 'err'); return; }
  Q.i = 0; $('q-slider').max = Q.res.steps.length - 1; $('q-slider').value = 0; syncSlider($('q-slider'));
  say($('q-msg'), Q.res.solved ? `Solution found: ${Q.res.restarts} restarts, ${Q.res.steps.length - 1} steps.` : `No solution, final h=${Q.res.h}. Increase the number of restarts.`, Q.res.solved ? 'ok' : 'err');
  qDraw();
};
$('q-slider').addEventListener('input', (e) => { Q.i = +e.target.value; qDraw(); });
$('q-play').onclick = () => {
  if (!Q.res) { say($('q-msg'), 'Press “Run” first.', 'err'); return; }
  clearInterval(Q.timer);
  if (Q.i >= Q.res.steps.length - 1) Q.i = 0;
  Q.timer = setInterval(() => {
    if (Q.i >= Q.res.steps.length - 1) { clearInterval(Q.timer); return; }
    Q.i++; $('q-slider').value = Q.i; syncSlider($('q-slider')); qDraw();
  }, 250);
};
qDraw();

// ======================= Week 4: Minimax =======================
const T = { b: Array(9).fill(null), over: false };
function tRender() {
  const box = $('t-board'); box.innerHTML = '';
  T.b.forEach((v, i) => {
    const btn = document.createElement('button');
    btn.innerHTML = v === 'X' ? '<svg class="x" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>' : v === 'O' ? '<svg class="o" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/></svg>' : ''; btn.disabled = !!v || T.over;
    btn.setAttribute('aria-label', `Cell ${i + 1}`);
    btn.onclick = () => tHuman(i); box.appendChild(btn);
  });
}
function tCheck() {
  const w = winner(T.b);
  if (w || isFull(T.b)) {
    T.over = true;
    say($('t-msg'), w === 'X' ? 'You win!' : w === 'O' ? 'AI wins.' : 'Draw.', w === 'X' ? 'ok' : '');
    return true;
  }
  return false;
}
function tAI() {
  const algo = $('t-algo').value;
  const res = aiMove(T.b, algo);
  const mm = minimax([...T.b], 'O').stats.nodes, ab = alphaBeta([...T.b], 'O').stats.nodes;
  T.b[res.move] = 'O';
  $('t-info').innerHTML = `<b>AI move:</b> cell ${res.move + 1}, value ${res.value}. Nodes searched — Minimax: <b>${mm}</b>, Alpha-Beta: <b>${ab}</b> ` +
    `(${(100 * (1 - ab / mm)).toFixed(0)}% saved). Selected: ${algo === 'minimax' ? 'Minimax' : 'Alpha-Beta'}.<br>` +
    'Minimax searches the whole game tree, maximizing the value for the AI and minimizing it for the human; Alpha-Beta prunes branches that cannot change the result.';
}
function tHuman(i) {
  if (T.over || T.b[i]) return;
  T.b[i] = 'X';
  if (!tCheck()) { say($('t-msg'), ''); tAI(); tCheck(); }
  tRender();
}
$('t-new').onclick = () => {
  T.b = Array(9).fill(null); T.over = false; say($('t-msg'), 'Your move (X).'); $('t-info').textContent = '';
  if ($("t-first").value === "ai") { tAI(); say($('t-msg'), 'Your move (X).'); }
  tRender();
};
$('t-new').click();

$('q-run').click(); // initial demo: 8 queens
showTab(location.hash.slice(1));

// ?demo — preset state for screenshots / the defense (maze + comparison, first TTT move)
if (new URLSearchParams(location.search).has('demo')) {
  for (let r = 0; r <= 10; r++) S.cells[r][8] = 0;
  for (let r = 4; r <= 14; r++) S.cells[r][16] = 0;
  for (let r = 11; r <= 13; r++) for (let c = 9; c <= 11; c++) S.cells[r][c] = 5;
  sDraw(); $('s-compare').click();
  tHuman(4);
}
