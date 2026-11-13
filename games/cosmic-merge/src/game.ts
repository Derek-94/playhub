// 게임 규칙만 담은 순수 로직. 화면(DOM)과 분리해 두면 테스트하기 쉽다.
// 보드 칸 값: 0 = 빈칸, 1 이상 = 천체 단계(level)

export const SIZE = 4;
export type Board = number[][];
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface MoveResult {
  board: Board;
  gained: number;
  moved: boolean;
  merged: Set<string>; // 이번에 합쳐진 칸 "r,c" (애니메이션용)
}

// 단계가 올라갈수록 점수가 두 배씩 커진다.
export const pointsFor = (level: number) => 2 ** level;

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

// 빈칸 하나에 새 천체를 놓는다. 90% 확률로 1단계, 10% 확률로 2단계.
export function spawn(board: Board, rng = Math.random): [number, number] | null {
  const empties: [number, number][] = [];
  board.forEach((row, r) => row.forEach((v, c) => v === 0 && empties.push([r, c])));
  if (empties.length === 0) return null;
  const [r, c] = empties[Math.floor(rng() * empties.length)];
  board[r][c] = rng() < 0.9 ? 1 : 2;
  return [r, c];
}

// 한 줄을 앞쪽(index 0 방향)으로 밀면서 같은 단계끼리 한 번씩 합친다.
function slideLine(line: number[]) {
  const tiles = line.filter((v) => v !== 0);
  const out: number[] = [];
  const mergedAt: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      const next = tiles[i] + 1;
      mergedAt.push(out.length);
      out.push(next);
      gained += pointsFor(next);
      i++; // 합쳐진 짝은 건너뛴다
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { out, gained, mergedAt };
}

// 방향별로 "앞쪽부터" 읽은 칸 좌표 목록을 만든다.
function lineCoords(dir: Dir, k: number): [number, number][] {
  const idx = [...Array(SIZE).keys()];
  switch (dir) {
    case 'left':  return idx.map((i) => [k, i]);
    case 'right': return idx.map((i) => [k, SIZE - 1 - i]);
    case 'up':    return idx.map((i) => [i, k]);
    case 'down':  return idx.map((i) => [SIZE - 1 - i, k]);
  }
}

export function move(board: Board, dir: Dir): MoveResult {
  const next = emptyBoard();
  const merged = new Set<string>();
  let gained = 0;
  let moved = false;
  for (let k = 0; k < SIZE; k++) {
    const coords = lineCoords(dir, k);
    const line = coords.map(([r, c]) => board[r][c]);
    const res = slideLine(line);
    gained += res.gained;
    coords.forEach(([r, c], i) => {
      next[r][c] = res.out[i];
      if (res.out[i] !== line[i]) moved = true;
    });
    res.mergedAt.forEach((i) => merged.add(coords[i].join(',')));
  }
  return { board: next, gained, moved, merged };
}

export function canMove(board: Board): boolean {
  return (['up', 'down', 'left', 'right'] as Dir[]).some((d) => move(board, d).moved);
}
