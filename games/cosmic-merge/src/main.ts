import { loginGuest, submitScore } from 'playhub-sdk';
import { SIZE, canMove, emptyBoard, move, spawn, type Board, type Dir } from './game';

// 서버 모듈(server/modules/src/main.ts)의 리더보드 ID와 같아야 한다.
const GAME_ID = 'cosmic-merge';

// 단계별 천체. 합칠수록 아래로 진화한다.
const BODIES = [
  { emoji: '✨', name: '별가루' },
  { emoji: '🪨', name: '운석' },
  { emoji: '🌑', name: '위성' },
  { emoji: '🌍', name: '행성' },
  { emoji: '🪐', name: '고리 행성' },
  { emoji: '☀️', name: '항성' },
  { emoji: '🌟', name: '거성' },
  { emoji: '💫', name: '성운' },
  { emoji: '🌌', name: '은하' },
  { emoji: '🕳️', name: '블랙홀' },
];
const bodyOf = (level: number) => BODIES[Math.min(level, BODIES.length) - 1];

const BEST_KEY = 'cosmic-merge.best';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const boardEl = $('board');

let board: Board;
let score = 0;
let best = Number(localStorage.getItem(BEST_KEY) ?? 0);
let over = false;

function render(fresh = new Set<string>(), merged = new Set<string>()) {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const level = board[r][c];
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (level) {
        const key = `${r},${c}`;
        const { emoji, name } = bodyOf(level);
        cell.classList.add('tile', `lv${Math.min(level, BODIES.length)}`);
        if (fresh.has(key)) cell.classList.add('fresh');
        if (merged.has(key)) cell.classList.add('merged');
        cell.innerHTML = `<span class="emoji">${emoji}</span><span class="name">${name}</span>`;
      }
      boardEl.appendChild(cell);
    }
  }
  $('score').textContent = String(score);
  $('best').textContent = String(best);
}

function newGame() {
  board = emptyBoard();
  score = 0;
  over = false;
  $('over').hidden = true;
  const a = spawn(board);
  const b = spawn(board);
  render(new Set([a, b].filter(Boolean).map((p) => p!.join(','))));
}

function step(dir: Dir) {
  if (over) return;
  const res = move(board, dir);
  if (!res.moved) return;
  board = res.board;
  score += res.gained;
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }
  const p = spawn(board);
  render(new Set(p ? [p.join(',')] : []), res.merged);
  if (!canMove(board)) endGame();
}

// 로그인은 게임 시작과 동시에 백그라운드로. 실패해도 게임은 그대로 할 수 있다.
const login = loginGuest()
  .then((me) => {
    $('player').textContent = `게스트 ${me.username}`;
    return true;
  })
  .catch(() => {
    $('player').textContent = '오프라인 (랭킹 미등록)';
    return false;
  });

async function endGame() {
  over = true;
  const finalScore = score;
  $('final').textContent = String(finalScore);
  $('over').hidden = false;

  const status = $('submit-status');
  if (finalScore === 0) {
    status.textContent = '';
    return;
  }
  status.textContent = '랭킹에 등록하는 중...';
  if (!(await login)) {
    status.textContent = '서버에 연결되지 않아 랭킹에 등록하지 못했어요';
    return;
  }
  try {
    await submitScore(GAME_ID, finalScore);
    status.textContent = '랭킹에 등록했어요';
    // 포털(부모 창)에 알려서 랭킹을 새로고침하게 한다. 단독 실행이면 parent === window라 무해하다.
    window.parent.postMessage({ type: 'playhub:score-submitted', gameId: GAME_ID, score: finalScore }, '*');
  } catch {
    status.textContent = '랭킹 등록에 실패했어요';
  }
}

// 키보드
const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};
window.addEventListener('keydown', (e) => {
  const dir = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (!dir) return;
  e.preventDefault();
  step(dir);
});

// 터치 스와이프
let touchStart: { x: number; y: number } | null = null;
boardEl.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });
boardEl.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  step(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

$('restart').addEventListener('click', newGame);
$('retry').addEventListener('click', newGame);

// 진화 순서 안내
$('legend').innerHTML = BODIES.map((b) => `<li>${b.emoji}<small>${b.name}</small></li>`).join('');

newGame();
