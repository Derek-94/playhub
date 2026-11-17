// sim.ts 간단 검증. 실행: node --experimental-strip-types games/mungtari/scripts/check-sim.ts
import { applyAction, createMatch, dealItems, DOG_X, makeRng, simulate, windForTurn, type Side } from '../src/sim.ts';
import { bestShot, planBotShot, type Difficulty } from '../src/bot.ts';

let fails = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? `  (${extra})` : ''}`);
  if (!ok) fails++;
};

// 1) 바람 0이면 좌우 대칭
for (const [angle, power] of [[45, 0.7], [60, 0.8], [30, 0.5]]) {
  const a = simulate({ side: 'left', angle, power, wind: 0 }).bones[0];
  const b = simulate({ side: 'right', angle, power, wind: 0 }).bones[0];
  const la = a.points.at(-1)!, lb = b.points.at(-1)!;
  const sym = a.points.length === b.points.length && Math.abs(la.x - (1000 - lb.x)) < 1e-6 && Math.abs(la.y - lb.y) < 1e-6;
  check(`바람 0 대칭 angle=${angle} power=${power}`, sym && a.outcome === b.outcome, `${a.outcome} / ${b.outcome}`);
}

// 2) 최대 힘이면 어느 각도든 맵 밖
let allOut = true;
for (let angle = 0; angle <= 90; angle += 5) {
  for (const wind of [-5, 0, 5]) {
    const r = simulate({ side: 'left', angle, power: 1, wind });
    if (r.bones[0].outcome !== 'out') allOut = false;
  }
}
check('최대 힘이면 항상 맵 밖', allOut);

// 3) 낮고 약하게 던지면 울타리에 막힌다
const low = simulate({ side: 'left', angle: 15, power: 0.62, wind: 0 }).bones[0];
check('낮게 던지면 울타리에 막힘', low.hitFence && low.outcome === 'fence', `${low.outcome}, 끝 x=${low.points.at(-1)!.x.toFixed(0)}`);
check('막힌 뼈는 내 쪽에 떨어짐', low.points.at(-1)!.x < 500);

// 4) 맞히는 샷이 존재하고, 바람이 결과를 바꾼다
const state = createMatch(42);
const s0 = { ...state, wind: 0 };
const best = bestShot(s0, null);
const hit = simulate({ side: 'left', ...best, wind: 0 }).bones[0];
check('바람 0에서 명중 샷 존재', hit.victim === 'right', `${JSON.stringify(best)} → ${hit.outcome}`);
const pushed = simulate({ side: 'left', ...best, wind: 5 }).bones[0];
check('순풍 5면 더 멀리 감', pushed.points.at(-1)!.x > hit.points.at(-1)!.x, `${pushed.outcome}`);

// 5) 시드가 같으면 같은 바람·아이템
check('같은 시드 → 같은 바람', windForTurn(7, 3) === windForTurn(7, 3));
const winds = Array.from({ length: 200 }, (_, i) => windForTurn(123, i));
check('바람 범위 -5~5', winds.every((w) => w >= -5 && w <= 5 && Number.isInteger(w)), `min ${Math.min(...winds)} max ${Math.max(...winds)}`);
check('바람이 매 턴 다양함', new Set(winds).size === 11);
const items = dealItems(99, 'left');
check('아이템 3개, 중복 없음', items.length === 3 && new Set(items).size === 3, items.join(','));
check('같은 시드 → 같은 아이템', dealItems(99, 'left').join() === items.join());

// 6) 아이템 효과
const big = simulate({ side: 'left', ...best, wind: 0, item: 'big' }).bones[0];
check('왕뼈다귀는 사거리 짧음', big.points.at(-1)!.x < hit.points.at(-1)!.x);
const dbl = simulate({ side: 'left', ...best, wind: 0, item: 'double' });
check('더블 뼈다귀는 2개', dbl.bones.length === 2);
const calm = simulate({ side: 'left', ...best, wind: 5, item: 'calm' });
check('바람 멈춤이면 바람 0', calm.wind === 0 && calm.bones[0].points.at(-1)!.x === hit.points.at(-1)!.x);

// 7) 리듀서: 데미지·턴·20턴 제한
let st = createMatch(1);
const r1 = applyAction({ ...st, wind: 0 }, { kind: 'throw', ...best, item: null });
check('명중하면 HP 감소', r1.state.hp.right < 100 && r1.state.current === 'right', `HP ${r1.state.hp.right}`);
check('없는 아이템은 무시', applyAction(st, { kind: 'throw', angle: 45, power: 0.5, item: 'sniff' as any }).state.items.left.length >= 2);
for (let i = 0; i < 20; i++) st = applyAction(st, { kind: 'skip' }).state;
check('20턴이면 끝 (동점 무승부)', st.over && st.winner === 'draw');

// 8) 봇 난이도별 명중률 (바람 랜덤)
for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
  const rng = makeRng(2024);
  let hits = 0;
  const N = 150;
  for (let i = 0; i < N; i++) {
    const m = { ...createMatch(i + 1, 'right' as Side), items: { left: [], right: [] } };
    const a = planBotShot(m, d, rng);
    const res = applyAction(m, a);
    if (res.shot!.damage.left > 0) hits++;
  }
  console.log(`   봇 ${d}: 명중(스침 포함) ${Math.round((hits / N) * 100)}%`);
}

// 9) 한 판 끝까지 (봇 vs 봇)
let g = createMatch(777);
const rng = makeRng(5);
while (!g.over) g = applyAction(g, planBotShot(g, 'normal', rng)).state;
console.log(`   봇 대 봇 한 판: ${g.turn}턴, 승자 ${g.winner}, HP ${g.hp.left}/${g.hp.right}`);
check('한 판이 끝남', g.over);
void DOG_X;

console.log(fails ? `\n${fails}개 실패` : '\n모두 통과');
process.exit(fails ? 1 : 0);
