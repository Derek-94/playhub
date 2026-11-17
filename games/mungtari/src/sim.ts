// 멍타리 대전의 물리 + 규칙. 화면(DOM)도, npm 라이브러리도 쓰지 않는 순수 함수만 둔다.
// 2단계에서 Nakama 서버 모듈(JS 런타임)이 이 파일을 그대로 가져가 판정에 쓴다.
// 좌표계: 캔버스와 같다. x는 오른쪽, y는 아래쪽이 +.

export type Side = 'left' | 'right';
export type ItemId = 'double' | 'big' | 'calm' | 'sniff';
export type Outcome = 'head' | 'body' | 'graze' | 'miss' | 'fence' | 'out';

// ── 조정 포인트: 규칙 수치 ─────────────────────────────
export const RULES = {
  HP: 100,
  DMG_BODY: 25, // 몸 직격
  DMG_HEAD: 35, // 머리 명중
  DMG_GRAZE: 10, // 근처 착탄
  BIG_DMG_MULT: 1.5, // 왕뼈다귀 데미지 배수
  TURN_SECONDS: 15,
  MAX_TURNS: 20, // 두 마리 합쳐서 20번 던지면 끝
  WIND_MAX: 5, // 바람 -5 ~ +5 (+는 오른쪽으로 부는 바람)
  START_ITEMS: 3,
} as const;

// ── 조정 포인트: 물리 수치 ─────────────────────────────
export const PHYS = {
  G: 600, // 중력 (px/s²)
  VMAX: 900, // 힘 100% 직전의 던지는 속도 (px/s)
  WIND_ACC: 20, // 바람 1칸당 가로 가속도 (px/s²)
  DT: 1 / 60, // 한 스텝 시간. 궤적 점 하나 = 1/60초
  BONE_R: 12, // 뼈다귀 판정 반지름 (그림 크기도 이걸 따라간다)
  BIG_R: 18,
  BIG_WIND: 0.5, // 왕뼈다귀는 바람 영향이 절반
  BIG_SPEED: 0.85, // 왕뼈다귀는 무거워서 속도(사거리)가 줄어든다
  DOUBLE_POWER: 0.96, // 더블 뼈다귀의 두 번째 뼈는 힘이 살짝 약하다
  OVER_SPEED: 2.2, // 게이지를 끝까지 채우면 이만큼 세게 날아가 맵 밖으로
  GRAZE_RANGE: 62, // 강아지 중심에서 이 거리 안에 떨어지면 스침
  MAX_STEPS: 1500,
} as const;

// ── 맵 ────────────────────────────────────────────────
export const WORLD = { W: 1000, H: 560, GROUND: 470 } as const;
export const FENCE = { x: 460, w: 80, top: 330 } as const; // 울타리 사각형 (바닥까지). 그림(fence.png) 판자 폭에 맞춤
export const DOG_X: Record<Side, number> = { left: 150, right: 850 };

export const ITEM_IDS: ItemId[] = ['double', 'big', 'calm', 'sniff'];

export const other = (s: Side): Side => (s === 'left' ? 'right' : 'left');
const faceOf = (s: Side) => (s === 'left' ? 1 : -1);

export interface Pt { x: number; y: number }
interface Circle extends Pt { r: number }

// 강아지 판정 영역: 머리 원 + 몸 원. 머리는 상대 쪽을 보고 있다.
// ── 조정 포인트: 강아지 크기 배수. 맞는 범위·던지는 위치·그림 크기가 함께 커진다 ──
export const DOG_SIZE = 1.2;

export function dogHitboxes(side: Side): { head: Circle; body: Circle } {
  const x = DOG_X[side];
  const f = faceOf(side);
  const k = DOG_SIZE;
  return {
    body: { x, y: WORLD.GROUND - 26 * k, r: 28 * k },
    head: { x: x + 20 * k * f, y: WORLD.GROUND - 60 * k, r: 19 * k },
  };
}

// 뼈다귀가 출발하는 위치 (강아지 입 근처)
export function launchPoint(side: Side): Pt {
  return { x: DOG_X[side] + 34 * DOG_SIZE * faceOf(side), y: WORLD.GROUND - 72 * DOG_SIZE };
}

// ── 시드 랜덤 (mulberry32) ─────────────────────────────
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 같은 시드 + 같은 턴이면 항상 같은 바람.
export function windForTurn(seed: number, turn: number): number {
  const rng = makeRng((seed ^ Math.imul(turn + 1, 0x9e3779b1)) >>> 0);
  rng();
  return Math.floor(rng() * (RULES.WIND_MAX * 2 + 1)) - RULES.WIND_MAX;
}

// 시작 아이템: 4종 중 서로 다른 3개.
export function dealItems(seed: number, side: Side): ItemId[] {
  const rng = makeRng((seed ^ (side === 'left' ? 0x1234567 : 0x7654321)) >>> 0);
  const pool = [...ITEM_IDS];
  const out: ItemId[] = [];
  while (out.length < RULES.START_ITEMS && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

// ── 던지기 시뮬레이션 ─────────────────────────────────
export interface ShotInput {
  side: Side; // 던지는 쪽
  angle: number; // 도(°). 0 = 상대 쪽 수평, 90 = 바로 위
  power: number; // 0~1. 1 이상이면 "너무 셈" → 맵 밖
  wind: number;
  item?: ItemId | null;
}

export interface BoneResult {
  points: Pt[]; // 1/60초 간격 궤적
  outcome: Outcome;
  victim: Side | null; // 맞은 강아지 (자기 자신일 수도 있다)
  damage: number;
  hitFence: boolean;
  radius: number;
  big: boolean;
}

export interface ShotResult {
  bones: BoneResult[];
  wind: number; // 실제로 적용된 바람 (바람 멈춤이면 0)
  damage: Record<Side, number>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

function damageFor(outcome: Outcome, big: boolean): number {
  const base =
    outcome === 'head' ? RULES.DMG_HEAD : outcome === 'body' ? RULES.DMG_BODY : outcome === 'graze' ? RULES.DMG_GRAZE : 0;
  return Math.round(base * (big ? RULES.BIG_DMG_MULT : 1));
}

function flyBone(side: Side, angleDeg: number, power: number, wind: number, big: boolean): BoneResult {
  const f = faceOf(side);
  const over = power >= 1;
  const r = big ? PHYS.BIG_R : PHYS.BONE_R;
  const rad = (clamp(angleDeg, 0, 90) * Math.PI) / 180;
  const speed = over ? PHYS.VMAX * PHYS.OVER_SPEED : PHYS.VMAX * clamp(power, 0, 1) * (big ? PHYS.BIG_SPEED : 1);
  const ax = wind * PHYS.WIND_ACC * (big ? PHYS.BIG_WIND : 1);
  const start = launchPoint(side);
  let { x, y } = start;
  let vx = Math.cos(rad) * speed * f;
  let vy = -Math.sin(rad) * speed;
  const points: Pt[] = [{ x, y }];
  const boxes = { left: dogHitboxes('left'), right: dogHitboxes('right') };
  let leftSelf = false; // 던진 강아지의 몸에서 벗어났는지 (벗어나기 전엔 자기 판정 무시)
  let hitFence = false;

  const done = (outcome: Outcome, victim: Side | null): BoneResult => ({
    points,
    outcome,
    victim,
    damage: damageFor(outcome, big),
    hitFence,
    radius: r,
    big,
  });

  for (let i = 0; i < PHYS.MAX_STEPS; i++) {
    const prevY = y;
    vx += ax * PHYS.DT;
    vy += PHYS.G * PHYS.DT;
    x += vx * PHYS.DT;
    y += vy * PHYS.DT;

    if (over) {
      // 너무 세게 던진 뼈는 아무것도 맞히지 않고 맵 밖으로 사라진다.
      points.push({ x, y });
      if (x < -80 || x > WORLD.W + 80 || y < -700 || y > WORLD.H + 80) return done('out', null);
      continue;
    }

    if (x < -40 || x > WORLD.W + 40) {
      points.push({ x, y });
      return done('out', null);
    }

    // 울타리: 원-사각형 충돌. 옆에서 맞으면 튕겨 떨어지고, 위에서 맞으면 살짝 튀어 굴러 떨어진다.
    const nx = clamp(x, FENCE.x, FENCE.x + FENCE.w);
    const ny = clamp(y, FENCE.top, WORLD.GROUND);
    if (dist2(x, y, nx, ny) < r * r) {
      hitFence = true;
      if (prevY + r <= FENCE.top + 1) {
        y = FENCE.top - r;
        vy = -Math.abs(vy) * 0.3;
        const away = x < FENCE.x + FENCE.w / 2 ? -1 : 1;
        vx = away * Math.max(Math.abs(vx) * 0.5, 60);
      } else if (x < FENCE.x + FENCE.w / 2) {
        x = FENCE.x - r;
        vx = -Math.abs(vx) * 0.2;
      } else {
        x = FENCE.x + FENCE.w + r;
        vx = Math.abs(vx) * 0.2;
      }
    }

    // 강아지: 머리 먼저, 그다음 몸
    let touchingSelf = false;
    for (const s of ['left', 'right'] as Side[]) {
      const { head, body } = boxes[s];
      const onHead = dist2(x, y, head.x, head.y) < (head.r + r) ** 2;
      const onBody = dist2(x, y, body.x, body.y) < (body.r + r) ** 2;
      if (s === side && !leftSelf) {
        if (onHead || onBody) touchingSelf = true;
        continue;
      }
      if (onHead) {
        points.push({ x, y });
        return done('head', s);
      }
      if (onBody) {
        points.push({ x, y });
        return done('body', s);
      }
    }
    if (!touchingSelf) leftSelf = true;

    // 땅에 닿음
    if (y + r >= WORLD.GROUND) {
      y = WORLD.GROUND - r;
      points.push({ x, y });
      for (const s of ['left', 'right'] as Side[]) {
        if (s === side && !leftSelf) continue;
        if (Math.abs(x - DOG_X[s]) < PHYS.GRAZE_RANGE) return done('graze', s);
      }
      return done(hitFence ? 'fence' : 'miss', null);
    }
    points.push({ x, y });
  }
  return done('miss', null);
}

export function simulate(input: ShotInput): ShotResult {
  const item = input.item ?? null;
  const wind = item === 'calm' ? 0 : input.wind;
  const big = item === 'big';
  const bones = [flyBone(input.side, input.angle, input.power, wind, big)];
  if (item === 'double') {
    const p2 = input.power >= 1 ? input.power : input.power * PHYS.DOUBLE_POWER;
    bones.push(flyBone(input.side, input.angle, p2, wind, false));
  }
  const damage: Record<Side, number> = { left: 0, right: 0 };
  for (const b of bones) if (b.victim) damage[b.victim] += b.damage;
  return { bones, wind, damage };
}

// 킁킁 코: 예상 궤적을 준다. 기본은 착탄까지 전체, fraction을 주면 앞부분만.
export function previewPath(input: ShotInput, fraction = 1): Pt[] {
  const pts = simulate({ ...input, item: input.item === 'sniff' ? null : input.item }).bones[0].points;
  return pts.slice(0, Math.max(2, Math.floor(pts.length * fraction)));
}

// ── 한 판의 상태 (리듀서) ─────────────────────────────
export interface MatchState {
  seed: number;
  turn: number; // 지금까지 끝난 턴 수
  current: Side; // 이번에 던질 쪽
  hp: Record<Side, number>;
  items: Record<Side, ItemId[]>;
  wind: number; // 이번 턴 바람
  over: boolean;
  winner: Side | 'draw' | null;
}

export type Action =
  | { kind: 'throw'; angle: number; power: number; item: ItemId | null }
  | { kind: 'skip' }; // 시간 초과

export function createMatch(seed: number, first: Side = 'left'): MatchState {
  return {
    seed,
    turn: 0,
    current: first,
    hp: { left: RULES.HP, right: RULES.HP },
    items: { left: dealItems(seed, 'left'), right: dealItems(seed, 'right') },
    wind: windForTurn(seed, 0),
    over: false,
    winner: null,
  };
}

// 상태를 바꾸지 않고 새 상태를 돌려준다. 서버도 클라이언트도 같은 함수로 판정한다.
export function applyAction(state: MatchState, action: Action): { state: MatchState; shot: ShotResult | null } {
  if (state.over) return { state, shot: null };
  const side = state.current;
  const hp = { ...state.hp };
  const items = { left: [...state.items.left], right: [...state.items.right] };
  let shot: ShotResult | null = null;

  if (action.kind === 'throw') {
    let item = action.item;
    const idx = item ? items[side].indexOf(item) : -1;
    if (idx < 0) item = null; // 갖고 있지 않은 아이템은 무시
    else items[side].splice(idx, 1);
    const angle = Number.isFinite(action.angle) ? action.angle : 45;
    const power = Number.isFinite(action.power) ? Math.max(0, Math.min(1, action.power)) : 0;
    shot = simulate({ side, angle, power, wind: state.wind, item });
    hp.left = Math.max(0, hp.left - shot.damage.left);
    hp.right = Math.max(0, hp.right - shot.damage.right);
  }

  const turn = state.turn + 1;
  let over = false;
  let winner: MatchState['winner'] = null;
  if (hp.left <= 0 || hp.right <= 0) {
    over = true;
    winner = hp.left <= 0 && hp.right <= 0 ? other(side) : hp.left <= 0 ? 'right' : 'left';
  } else if (turn >= RULES.MAX_TURNS) {
    over = true;
    winner = hp.left === hp.right ? 'draw' : hp.left > hp.right ? 'left' : 'right';
  }

  return {
    shot,
    state: {
      ...state,
      turn,
      current: other(side),
      hp,
      items,
      wind: windForTurn(state.seed, turn),
      over,
      winner,
    },
  };
}
