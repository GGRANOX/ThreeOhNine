// Апта 4 — Adversarial Search: Minimax және Alpha-Beta (Tic-Tac-Toe).
// board: 9 элемент, 'X' | 'O' | null. AI = 'O' (maximize), адам = 'X' (minimize).
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function winner(b) {
  for (const [x, y, z] of LINES) if (b[x] && b[x] === b[y] && b[y] === b[z]) return b[x];
  return null;
}
export const isFull = (b) => b.every(Boolean);
export const moves = (b) => b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);

export function validateBoard(b) {
  if (!Array.isArray(b) || b.length !== 9) throw new Error('Тақта 9 ұяшықтан тұруы тиіс');
  if (b.some((v) => v !== null && v !== 'X' && v !== 'O')) throw new Error('Жарамсыз таңба');
  const x = b.filter((v) => v === 'X').length, o = b.filter((v) => v === 'O').length;
  if (Math.abs(x - o) > 1) throw new Error('Жарамсыз тақта күйі');
}

// Терминал мәні AI ('O') тұрғысынан: 10 - depth жеңіс, depth - 10 жеңіліс.
function evalTerminal(b, depth) {
  const w = winner(b);
  if (w === 'O') return 10 - depth;
  if (w === 'X') return depth - 10;
  return isFull(b) ? 0 : null;
}

export function minimax(b, player, depth = 0, stats = { nodes: 0 }) {
  stats.nodes++;
  const t = evalTerminal(b, depth);
  if (t !== null) return { value: t, move: null, stats };
  const max = player === 'O';
  let best = max ? -Infinity : Infinity, bestMove = null;
  for (const m of moves(b)) {
    b[m] = player;
    const { value } = minimax(b, max ? 'X' : 'O', depth + 1, stats);
    b[m] = null;
    if (max ? value > best : value < best) { best = value; bestMove = m; }
  }
  return { value: best, move: bestMove, stats };
}

export function alphaBeta(b, player, depth = 0, alpha = -Infinity, beta = Infinity, stats = { nodes: 0 }) {
  stats.nodes++;
  const t = evalTerminal(b, depth);
  if (t !== null) return { value: t, move: null, stats };
  const max = player === 'O';
  let best = max ? -Infinity : Infinity, bestMove = null;
  for (const m of moves(b)) {
    b[m] = player;
    const { value } = alphaBeta(b, max ? 'X' : 'O', depth + 1, alpha, beta, stats);
    b[m] = null;
    if (max ? value > best : value < best) { best = value; bestMove = m; }
    if (max) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
    if (beta <= alpha) break; // кесу (pruning)
  }
  return { value: best, move: bestMove, stats };
}

export function aiMove(board, algo = 'alphabeta') {
  validateBoard(board);
  const b = [...board];
  if (winner(b) || isFull(b)) throw new Error('Ойын аяқталған');
  return algo === 'minimax' ? minimax(b, 'O') : alphaBeta(b, 'O');
}
