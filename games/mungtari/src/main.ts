// 화면·입력·진행. 판정은 전부 sim.ts(applyAction)에 맡기고, 여기서는 보여주기만 한다.
import {
  applyAction, createMatch, launchPoint, makeRng, previewPath, dogHitboxes, DOG_X, RULES, WORLD,
  type Action, type BoneResult, type ItemId, type MatchState, type Pt, type Side,
} from './sim.ts';
import { planBotShot, type Difficulty } from './bot.ts';
import { img, isSoundOn, play, preloadImages, setSoundOn, startBgm } from './assets.ts';
import { INK, drawBackground, drawBone, drawBubble, drawDog, drawFence, drawItemIcon, drawPaw } from './draw.ts';

// ── 조정 포인트: 연출 ─────────────────────────────────
const CHARGE_SECONDS = 1.6; // 게이지가 0 → 끝까지 차는 시간
const FLIGHT_SPEED = 1.3; // 뼈다귀 날아가는 재생 속도 (1 = 실제 물리 시간)
const DOUBLE_DELAY = 0.28; // 더블 뼈다귀 두 번째가 출발하는 간격 (초)
const AFTER_SHOT = 1.0; // 착탄 후 다음 턴까지 쉬는 시간

const NAMES: Record<Side, string> = { left: '콩이', right: '보리' };
const ITEM_INFO: Record<ItemId, { name: string; desc: string }> = {
  double: { name: '더블', desc: '같은 궤도로 2개 연속 던지기 (두 번째는 살짝 짧게)' },
  big: { name: '왕뼈다귀', desc: '데미지 1.5배. 무거워서 바람은 덜 타지만 덜 날아가요' },
  calm: { name: '바람 멈춤', desc: '이번 턴 바람을 0으로' },
  sniff: { name: '킁킁 코', desc: '이번 턴 뼈다귀가 떨어질 곳까지 전체 궤적을 점선으로 보여 줘요' },
};
const OUTCOME_TEXT = { head: '머리 명중!', body: '명중!', graze: '스침', miss: '빗나감', fence: '울타리에 막혔다!', out: '앗, 너무 세게!' };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const gaugeFill = $('gauge-fill');
const gaugeLast = $('gauge-last');
const gaugeLastLabel = $('gauge-last-label');
const itemsEl = $('items');
const hintEl = $('hint');

type Phase = 'menu' | 'aim' | 'charge' | 'bot' | 'fly' | 'over';

interface Flight {
  shooter: Side;
  bones: BoneResult[];
  delays: number[];
  landed: boolean[];
  elapsed: number;
  end: number;
  next: MatchState;
}
interface FloatText { x: number; y: number; text: string; color: string; life: number; big: boolean }
interface Puff { x: number; y: number; vx: number; vy: number; r: number; life: number; star: boolean }
interface BotPlan { action: Extract<Action, { kind: 'throw' }>; t: number; startAim: number }

let phase: Phase = 'menu';
let difficulty: Difficulty = 'normal';
let match: MatchState = createMatch(1);
let botRng = makeRng(1);
let t = 0;
let timer: number = RULES.TURN_SECONDS;
let aim: Record<Side, number> = { left: 45, right: 45 };
let power = 0;
let lastPower: Record<Side, number | null> = { left: null, right: null };
let selected: ItemId | null = null;
let flight: Flight | null = null;
let botPlan: BotPlan | null = null;
let shownHp: Record<Side, number> = { left: RULES.HP, right: RULES.HP };
let targetHp: Record<Side, number> = { left: RULES.HP, right: RULES.HP };
let lastLanding: Pt | null = null; // 내 지난번 착탄 지점 (연습용 표시)
let floats: FloatText[] = [];
let puffs: Puff[] = [];
let banner = { text: '', life: 0 };
const fx: Record<Side, { hurt: number; throwing: number; bubble: string; bubbleLife: number }> = {
  left: { hurt: 0, throwing: 0, bubble: '', bubbleLife: 0 },
  right: { hurt: 0, throwing: 0, bubble: '', bubbleLife: 0 },
};

// ── 캔버스 크기 (레티나 대응) ──────────────────────────
let scale = 1;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || WORLD.W;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round((cssW * WORLD.H * dpr) / WORLD.W);
  scale = canvas.width / WORLD.W;
}
window.addEventListener('resize', resize);
resize();

// ── 게임 시작 / 턴 진행 ────────────────────────────────
function newGame(level: Difficulty) {
  difficulty = level;
  const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  match = createMatch(seed, 'left');
  botRng = makeRng(seed ^ 0xb0b1);
  shownHp = { left: RULES.HP, right: RULES.HP };
  targetHp = { ...shownHp };
  aim = { left: 45, right: 45 };
  lastPower = { left: null, right: null };
  lastLanding = null;
  floats = [];
  puffs = [];
  flight = null;
  $('menu').hidden = true;
  $('result').hidden = true;
  startBgm();
  startTurn();
}

function startTurn() {
  timer = RULES.TURN_SECONDS;
  power = 0;
  selected = null;
  banner = { text: `${NAMES[match.current]} 차례`, life: 1.4 };
  if (match.current === 'left') {
    phase = 'aim';
  } else {
    phase = 'bot';
    const action = planBotShot(match, difficulty, botRng) as BotPlan['action'];
    botPlan = { action, t: 0, startAim: aim.right };
  }
  renderItems();
}

function fire(shooter: Side, action: Action) {
  const { state: next, shot } = applyAction(match, action);
  power = 0;
  if (!shot) {
    // 시간 초과
    say(shooter, '시간 초과!');
    flight = { shooter, bones: [], delays: [], landed: [], elapsed: 0, end: AFTER_SHOT, next };
    phase = 'fly';
    renderItems();
    return;
  }
  if (action.kind === 'throw') {
    lastPower[shooter] = Math.min(action.power, 1);
    if (action.item) say(shooter, ITEM_INFO[action.item].name + '!');
  }
  fx[shooter].throwing = 1;
  play('throw');
  const delays = shot.bones.map((_, i) => i * DOUBLE_DELAY);
  const durations = shot.bones.map((b) => (b.points.length - 1) / 60 / FLIGHT_SPEED);
  const end = Math.max(...delays.map((d, i) => d + durations[i])) + AFTER_SHOT;
  flight = { shooter, bones: shot.bones, delays, landed: shot.bones.map(() => false), elapsed: 0, end, next };
  if (action.kind === 'throw' && action.item === 'calm') windShown = 0;
  phase = 'fly';
  selected = null;
  renderItems();
}

function endTurn() {
  if (!flight) return;
  match = flight.next;
  targetHp = { ...match.hp };
  flight = null;
  windShown = match.wind;
  if (match.over) {
    phase = 'over';
    play(match.winner === 'left' ? 'win' : 'lose');
    setTimeout(showResult, 900);
    renderItems();
    return;
  }
  startTurn();
}

function showResult() {
  const w = match.winner;
  $('result-title').textContent = w === 'left' ? '콩이 승리!' : w === 'right' ? '보리 승리…' : '무승부';
  const why = match.hp.left <= 0 || match.hp.right <= 0 ? '' : `${RULES.MAX_TURNS}턴이 끝나서 HP가 많은 쪽이 이겼어요. `;
  $('result-sub').textContent =
    w === 'left' ? `${why}보리가 꼬리를 내렸어요.` : w === 'right' ? `${why}다음엔 바람을 더 잘 읽어 봐요.` : '둘 다 지쳐서 같이 낮잠을 자요.';
  $('result-left').textContent = String(match.hp.left);
  $('result-right').textContent = String(match.hp.right);
  $('result').hidden = false;
}

function say(side: Side, text: string) {
  fx[side].bubble = text;
  fx[side].bubbleLife = 1.3;
}

// ── 착탄 연출 ─────────────────────────────────────────
function onLand(bone: BoneResult, shooter: Side) {
  const p = bone.points[bone.points.length - 1];
  if (shooter === 'left' && bone.outcome !== 'out') lastLanding = p;
  const color = bone.victim === 'left' ? '#d64b3c' : bone.victim === 'right' ? '#d64b3c' : INK;

  if (bone.outcome === 'out') {
    floats.push({ x: Math.min(Math.max(p.x, 120), WORLD.W - 120), y: 120, text: OUTCOME_TEXT.out, color: INK, life: 1.4, big: false });
    return;
  }
  for (let i = 0; i < 8; i++) {
    const a = Math.PI + (i / 7) * Math.PI;
    puffs.push({ x: p.x, y: p.y + bone.radius * 0.6, vx: Math.cos(a) * 50, vy: Math.sin(a) * 30, r: 5 + (i % 3) * 2, life: 0.6, star: false });
  }
  if (bone.outcome === 'fence') play('fence');
  if (bone.victim) {
    play('hit');
    if (bone.outcome !== 'graze') setTimeout(() => play('yelp'), 120);
    targetHp[bone.victim] = Math.max(0, targetHp[bone.victim] - bone.damage);
    fx[bone.victim].hurt = 1;
    say(bone.victim, bone.outcome === 'graze' ? '앗!' : '깨갱!');
    const head = dogHitboxes(bone.victim).head;
    floats.push({ x: head.x, y: head.y - 108, text: `${OUTCOME_TEXT[bone.outcome]} -${bone.damage}`, color, life: 1.4, big: bone.outcome === 'head' });
    if (bone.outcome === 'head') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        puffs.push({ x: p.x, y: p.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 40, r: 6, life: 0.7, star: true });
      }
    }
  } else {
    floats.push({ x: p.x, y: p.y - 40, text: OUTCOME_TEXT[bone.outcome], color, life: 1.2, big: false });
  }
}

// ── 입력 ──────────────────────────────────────────────
function toWorld(e: PointerEvent): Pt {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * WORLD.W, y: ((e.clientY - r.top) / r.height) * WORLD.H };
}
function aimAt(p: Pt) {
  const o = launchPoint('left');
  const dx = Math.max(p.x - o.x, 0.001);
  const dy = o.y - p.y;
  aim.left = Math.round(Math.min(90, Math.max(0, (Math.atan2(dy, dx) * 180) / Math.PI)));
}
const myTurn = () => phase === 'aim' || phase === 'charge';

canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'aim') return;
  canvas.setPointerCapture(e.pointerId);
  aimAt(toWorld(e));
  phase = 'charge';
  power = 0;
});
canvas.addEventListener('pointermove', (e) => {
  if (myTurn()) aimAt(toWorld(e));
});
const release = () => {
  if (phase === 'charge') fire('left', { kind: 'throw', angle: aim.left, power, item: selected });
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// 키보드: ←→(또는 ↑↓)로 각도, 스페이스 꾹 눌러 던지기
window.addEventListener('keydown', (e) => {
  if (!myTurn()) return;
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') aim.left = Math.min(90, aim.left + 1);
  else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') aim.left = Math.max(0, aim.left - 1);
  else if (e.code === 'Space' && phase === 'aim' && !e.repeat) {
    phase = 'charge';
    power = 0;
  } else return;
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') release();
});

document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) =>
  b.addEventListener('click', () => newGame(b.dataset.level as Difficulty)),
);
$('again').addEventListener('click', () => newGame(difficulty));
$('to-menu').addEventListener('click', () => {
  $('result').hidden = true;
  $('menu').hidden = false;
  phase = 'menu';
});

// ── 아이템 칸 ─────────────────────────────────────────
function renderItems() {
  itemsEl.innerHTML = '';
  for (let i = 0; i < RULES.START_ITEMS; i++) {
    const id = match.items.left[i];
    const btn = document.createElement('button');
    btn.className = 'item';
    if (!id) {
      btn.classList.add('used');
      itemsEl.appendChild(btn);
      continue;
    }
    btn.title = `${ITEM_INFO[id].name}: ${ITEM_INFO[id].desc}`;
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    drawItemIcon(c.getContext('2d')!, id, 96);
    const label = document.createElement('span');
    label.textContent = ITEM_INFO[id].name;
    btn.append(c, label);
    btn.disabled = phase !== 'aim';
    if (selected === id) btn.classList.add('on');
    btn.addEventListener('click', () => {
      if (phase !== 'aim') return;
      selected = selected === id ? null : id;
      windShown = selected === 'calm' ? 0 : match.wind;
      renderItems();
    });
    itemsEl.appendChild(btn);
  }
  updateHint();
}

function updateHint() {
  if (phase === 'aim' || phase === 'charge') {
    hintEl.textContent = selected ? `${ITEM_INFO[selected].name} 장착! ${ITEM_INFO[selected].desc}` : '꾸욱 눌러서 힘을 모으고, 떼면 던져요. 게이지 끝까지 가면 맵 밖으로!';
  } else if (phase === 'bot') hintEl.textContent = '보리가 바람을 재는 중…';
  else if (phase === 'fly') hintEl.textContent = '';
  else hintEl.textContent = '';
}

// ── 매 프레임 갱신 ────────────────────────────────────
let windShown = 0;

function update(dt: number) {
  t += dt;
  for (const s of ['left', 'right'] as Side[]) {
    fx[s].hurt = Math.max(0, fx[s].hurt - dt * 1.4);
    fx[s].throwing = Math.max(0, fx[s].throwing - dt * 3);
    fx[s].bubbleLife = Math.max(0, fx[s].bubbleLife - dt);
    // HP 바는 부드럽게 줄어든다
    shownHp[s] += (targetHp[s] - shownHp[s]) * Math.min(1, dt * 6);
  }
  banner.life = Math.max(0, banner.life - dt);
  floats = floats.filter((f) => (f.life -= dt) > 0);
  for (const f of floats) f.y -= dt * 30;
  puffs = puffs.filter((p) => (p.life -= dt) > 0);
  for (const p of puffs) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.star ? 300 : -20) * dt;
  }

  if (phase === 'aim' || phase === 'charge') {
    timer -= dt;
    if (phase === 'charge') {
      power += dt / CHARGE_SECONDS;
      if (power >= 1) {
        power = 1;
        fire('left', { kind: 'throw', angle: aim.left, power: 1, item: selected });
        return;
      }
    }
    if (timer <= 0) fire('left', { kind: 'skip' });
  } else if (phase === 'bot' && botPlan) {
    // 보리: 1초 동안 각도를 맞추고, 그다음 힘을 모아서 던진다
    timer -= dt;
    botPlan.t += dt;
    const { action } = botPlan;
    const think = 1.0;
    const k = Math.min(1, botPlan.t / think);
    const ease = k * k * (3 - 2 * k);
    aim.right = botPlan.startAim + (action.angle - botPlan.startAim) * ease + (k < 1 ? Math.sin(t * 9) * 3 * (1 - k) : 0);
    if (k === 1 && botPlan.t < think + 0.05 && action.item) selectedBot = action.item;
    if (botPlan.t > think + 0.25) {
      power = Math.min(action.power, ((botPlan.t - think - 0.25) / CHARGE_SECONDS));
      if (power >= action.power) {
        aim.right = action.angle;
        botPlan = null;
        selectedBot = null;
        fire('right', action);
      }
    }
  } else if (phase === 'fly' && flight) {
    flight.elapsed += dt;
    flight.bones.forEach((b, i) => {
      if (flight!.landed[i]) return;
      const idx = (flight!.elapsed - flight!.delays[i]) * 60 * FLIGHT_SPEED;
      if (idx >= b.points.length - 1) {
        flight!.landed[i] = true;
        onLand(b, flight!.shooter);
      }
    });
    if (flight.elapsed >= flight.end) endTurn();
  }
}
let selectedBot: ItemId | null = null;

// ── 그리기 ────────────────────────────────────────────
function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawBackground(ctx, t, windShown);

  // 지난번 내 착탄 지점
  if (lastLanding && myTurn()) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawPaw(ctx, lastLanding.x, WORLD.GROUND + 14, 0.9, INK);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText('지난번', lastLanding.x, WORLD.GROUND + 36);
    ctx.restore();
  }

  drawFence(ctx, t, windShown);

  const winner = match.over && phase === 'over' ? match.winner : null;
  for (const s of ['left', 'right'] as Side[]) {
    drawDog(ctx, s, DOG_X[s], {
      t,
      aim: aim[s],
      hurt: fx[s].hurt,
      throwing: fx[s].throwing,
      charging: (phase === 'charge' && s === 'left') || (phase === 'bot' && s === 'right' && power > 0),
      mood: winner === s ? 'happy' : winner && winner !== 'draw' ? 'sad' : 'idle',
    });
  }

  // 조준선
  const shooter: Side | null = myTurn() ? 'left' : phase === 'bot' ? 'right' : null;
  if (shooter) drawAim(shooter);

  // 킁킁 코 미리보기
  if (myTurn() && selected === 'sniff') {
    const p = phase === 'charge' ? Math.min(power, 0.99) : lastPower.left ?? 0.65;
    const pts = previewPath({ side: 'left', angle: aim.left, power: p, wind: match.wind });
    ctx.fillStyle = 'rgba(74,52,40,0.7)';
    pts.forEach((pt, i) => {
      if (i % 4 !== 0 || pt.y < 0) return;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    // 떨어질 곳 표시 (X)
    const end = pts[pts.length - 1];
    if (end.x > 0 && end.x < WORLD.W) {
      ctx.save();
      ctx.strokeStyle = '#e4574a';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(end.x - 7, end.y - 7);
      ctx.lineTo(end.x + 7, end.y + 7);
      ctx.moveTo(end.x + 7, end.y - 7);
      ctx.lineTo(end.x - 7, end.y + 7);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 날아가는 뼈다귀
  if (flight) {
    flight.bones.forEach((b, i) => {
      if (flight!.landed[i] && b.outcome === 'out') return;
      const raw = (flight!.elapsed - flight!.delays[i]) * 60 * FLIGHT_SPEED;
      if (raw < 0) return;
      const idx = Math.min(b.points.length - 1, raw);
      const i0 = Math.floor(idx);
      const i1 = Math.min(b.points.length - 1, i0 + 1);
      const f = idx - i0;
      const x = b.points[i0].x + (b.points[i1].x - b.points[i0].x) * f;
      const y = b.points[i0].y + (b.points[i1].y - b.points[i0].y) * f;
      const landedNow = flight!.landed[i];
      if (landedNow && b.victim) return; // 맞으면 사라진다
      const rot = landedNow ? 0.15 : (flight!.shooter === 'left' ? 1 : -1) * raw * 0.22;
      if (y < -10) drawOffscreen(x, y);
      else drawBone(ctx, x, y, rot, b.radius);
    });
  }

  for (const p of puffs) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    const sprite = img(p.star ? 'fx-star' : 'fx-dust');
    if (sprite) {
      const size = p.star ? p.r * 3 : p.r * 2.4 * (1.6 - p.life);
      ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
    } else if (p.star) {
      ctx.fillStyle = '#ffd34d';
      drawStar(p.x, p.y, p.r);
    } else {
      ctx.fillStyle = '#e8d9bd';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1.6 - p.life), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  for (const s of ['left', 'right'] as Side[]) {
    if (fx[s].bubbleLife > 0) {
      drawBubble(ctx, DOG_X[s] + (s === 'left' ? 10 : -10), WORLD.GROUND - 126, fx[s].bubble, Math.min(1, fx[s].bubbleLife * 3));
    }
  }
  for (const f of floats) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.font = `900 ${f.big ? 26 : 20}px "Apple SD Gothic Neo", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fffaf1';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }

  drawHud();

  // 게이지 (HTML)
  const shownPower = phase === 'charge' || (phase === 'bot' && power > 0) ? power : 0;
  gaugeFill.style.width = `${shownPower * 100}%`;
  gaugeFill.classList.toggle('hot', shownPower > 0.9);
  const lp = lastPower.left;
  // 지난번에 던진 힘 눈금 (다음 턴에 힘 조절할 때 기준으로 쓰라고)
  const showLast = lp != null && phase !== 'bot';
  gaugeLast.style.display = gaugeLastLabel.style.display = showLast ? 'block' : 'none';
  if (lp != null) gaugeLast.style.left = gaugeLastLabel.style.left = `${lp * 100}%`;
}

function drawAim(side: Side) {
  const o = launchPoint(side);
  const f = side === 'left' ? 1 : -1;
  const a = (aim[side] * Math.PI) / 180;
  const charging = side === 'left' ? phase === 'charge' : power > 0;
  const len = 46 + (charging ? power : 0) * 70;
  ctx.save();
  ctx.strokeStyle = 'rgba(74,52,40,0.7)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(o.x + Math.cos(a) * 14 * f, o.y - Math.sin(a) * 14);
  ctx.lineTo(o.x + Math.cos(a) * len * f, o.y - Math.sin(a) * len);
  ctx.stroke();
  ctx.setLineDash([]);
  // 화살촉
  const hx = o.x + Math.cos(a) * (len + 6) * f;
  const hy = o.y - Math.sin(a) * (len + 6);
  ctx.translate(hx, hy);
  ctx.rotate(f > 0 ? -a : Math.PI + a);
  ctx.fillStyle = side === 'left' ? '#e4574a' : '#4f8fbf';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // 각도 숫자
  ctx.save();
  ctx.font = '800 14px system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(aim[side])}°`, o.x - 46 * f, o.y - 50);
  ctx.restore();
}

function drawOffscreen(x: number, y: number) {
  const cx = Math.min(WORLD.W - 20, Math.max(20, x));
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, 6);
  ctx.lineTo(cx - 8, 20);
  ctx.lineTo(cx + 8, 20);
  ctx.closePath();
  ctx.fill();
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(-y / 10)}m`, cx, 34);
  ctx.restore();
}

function drawStar(x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawHud() {
  ctx.save();
  // HP 바
  for (const s of ['left', 'right'] as Side[]) {
    const w = 250;
    const x = s === 'left' ? 20 : WORLD.W - 20 - w;
    const y = 18;
    const ratio = Math.max(0, shownHp[s]) / RULES.HP;
    ctx.fillStyle = 'rgba(255,250,241,0.92)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 44, 12);
    ctx.fill();
    ctx.stroke();
    ctx.font = '800 15px "Apple SD Gothic Neo", system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.textAlign = s === 'left' ? 'left' : 'right';
    ctx.fillText(NAMES[s], s === 'left' ? x + 12 : x + w - 12, y + 22);
    const bx = s === 'left' ? x + 58 : x + 12;
    const bw = w - 70;
    ctx.fillStyle = '#eadfcc';
    ctx.beginPath();
    ctx.roundRect(bx, y + 14, bw, 16, 8);
    ctx.fill();
    ctx.fillStyle = ratio > 0.5 ? '#7cc06b' : ratio > 0.25 ? '#f2b84b' : '#e4574a';
    const fw = bw * ratio;
    if (fw > 0) {
      ctx.beginPath();
      ctx.roundRect(s === 'left' ? bx : bx + bw - fw, y + 14, fw, 16, 8);
      ctx.fill();
    }
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(targetHp[s])), bx + bw / 2, y + 23);
    // 보리가 장착한 아이템 표시
    if (s === 'right' && selectedBot) {
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`보리: ${ITEM_INFO[selectedBot].name} 장착`, x + w, y + 60);
    }
  }

  // 바람 상자
  const cx = WORLD.W / 2;
  ctx.fillStyle = 'rgba(255,250,241,0.92)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cx - 92, 14, 184, 36, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '800 14px "Apple SD Gothic Neo", system-ui, sans-serif';
  ctx.fillText('바람', cx - 80, 32);
  const n = Math.abs(windShown);
  if (n === 0) {
    ctx.textAlign = 'center';
    ctx.fillText('잠잠', cx + 18, 32);
  } else {
    const dir = Math.sign(windShown);
    ctx.fillStyle = '#5f87ad';
    for (let i = 0; i < n; i++) {
      const ax = cx - 26 + i * 15;
      ctx.beginPath();
      ctx.moveTo(ax + 6 * dir, 32);
      ctx.lineTo(ax - 4 * dir, 25);
      ctx.lineTo(ax - 4 * dir, 39);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.fillText(String(n), cx + 70, 32);
  }

  // 타이머 + 턴
  const tx = cx;
  const ty = 82;
  const live = phase === 'aim' || phase === 'charge' || phase === 'bot';
  const sec = Math.max(0, Math.ceil(timer));
  ctx.fillStyle = 'rgba(255,250,241,0.92)';
  ctx.beginPath();
  ctx.arc(tx, ty, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (live) {
    ctx.strokeStyle = sec <= 5 ? '#e4574a' : '#7cc06b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(tx, ty, 14, -Math.PI / 2, -Math.PI / 2 + (Math.max(0, timer) / RULES.TURN_SECONDS) * Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = sec <= 5 && live ? '#d64b3c' : INK;
  ctx.textAlign = 'center';
  ctx.font = '900 14px system-ui, sans-serif';
  ctx.fillText(live ? String(sec) : '·', tx, ty + 1);
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.fillText(`${Math.min(match.over ? match.turn : match.turn + 1, RULES.MAX_TURNS)} / ${RULES.MAX_TURNS}턴`, tx, ty + 34);

  // 차례 알림
  if (banner.life > 0) {
    drawBubble(ctx, cx, 160, banner.text, Math.min(1, banner.life * 2.5));
  }
  ctx.restore();
}

// ── 루프 ──────────────────────────────────────────────
let prev = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  if (canvas.width !== Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2))) resize();
  update(dt);
  if (phase !== 'fly' && phase !== 'over') windShown = selected === 'calm' && myTurn() ? 0 : match.wind;
  render();
  updateHint();
  requestAnimationFrame(frame);
}
// 소리 켜기/끄기
const soundBtn = $<HTMLButtonElement>('sound');
const paintSound = () => {
  soundBtn.textContent = isSoundOn() ? '소리 켜짐' : '소리 꺼짐';
  soundBtn.setAttribute('aria-pressed', String(isSoundOn()));
};
soundBtn.addEventListener('click', () => {
  setSoundOn(!isSoundOn());
  paintSound();
});
paintSound();

preloadImages(() => renderItems()); // 아이템 아이콘은 그림이 다 오면 다시 그린다
renderItems();
requestAnimationFrame(frame);

// 개발 서버에서만: 콘솔에서 상태를 들여다보는 창구 (빌드 결과물에는 빠진다)
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
  (window as unknown as Record<string, unknown>).__mungtari = {
    get match() { return match; },
    get phase() { return phase; },
  };
}
