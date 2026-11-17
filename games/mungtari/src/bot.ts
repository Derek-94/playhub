// 봇 보리의 두뇌. sim.ts처럼 순수 함수라서 나중에 서버의 "봇 대전 전환"에도 그대로 쓸 수 있다.
// 방법: 여러 각도·힘을 머릿속으로 던져 보고(simulate) 제일 잘 맞는 걸 고른 뒤, 난이도만큼 손을 떤다.
import { DOG_X, other, simulate, type Action, type ItemId, type MatchState } from './sim.ts';

export type Difficulty = 'easy' | 'normal' | 'hard';

// ── 조정 포인트: 난이도별 손떨림(표준편차) ─────────────
export const BOT_NOISE: Record<Difficulty, { angle: number; power: number; itemChance: number }> = {
  easy: { angle: 5, power: 0.075, itemChance: 0.25 },
  normal: { angle: 3, power: 0.04, itemChance: 0.4 },
  hard: { angle: 1.5, power: 0.02, itemChance: 0.6 },
};

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickItem(state: MatchState, chance: number, rng: () => number): ItemId | null {
  const mine = state.items[state.current];
  if (!mine.length || rng() > chance) return null;
  if (mine.includes('calm') && Math.abs(state.wind) >= 3) return 'calm';
  const attack = mine.filter((i) => i === 'big' || i === 'double');
  return attack.length ? attack[Math.floor(rng() * attack.length)] : null;
}

// 손떨림 없이 제일 좋은 한 수를 찾는다.
export function bestShot(state: MatchState, item: ItemId | null): { angle: number; power: number } {
  const side = state.current;
  const target = other(side);
  let best = { angle: 50, power: 0.7, score: Infinity };
  for (let angle = 35; angle <= 70; angle += 5) {
    for (let power = 0.3; power < 0.99; power += 0.01) {
      const bone = simulate({ side, angle, power, wind: state.wind, item }).bones[0];
      let score: number;
      if (bone.victim === target && bone.outcome === 'head') score = -2;
      else if (bone.victim === target && bone.outcome === 'body') score = -1;
      else if (bone.victim === side) score = 9999;
      else {
        const last = bone.points[bone.points.length - 1];
        score = bone.outcome === 'out' ? 5000 : Math.abs(last.x - DOG_X[target]);
      }
      // 같은 점수면 45도 근처를 더 좋아한다 (사람처럼 보이게)
      score += Math.abs(angle - 50) * 0.001;
      if (score < best.score) best = { angle, power, score };
    }
  }
  return { angle: best.angle, power: best.power };
}

export function planBotShot(state: MatchState, difficulty: Difficulty, rng: () => number): Action {
  const noise = BOT_NOISE[difficulty];
  const item = pickItem(state, noise.itemChance, rng);
  const { angle, power } = bestShot(state, item);
  return {
    kind: 'throw',
    item,
    angle: Math.min(85, Math.max(5, angle + gaussian(rng) * noise.angle)),
    power: Math.min(0.98, Math.max(0.2, power + gaussian(rng) * noise.power)),
  };
}
