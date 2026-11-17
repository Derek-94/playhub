// 그림 그리기 전용. 이미지 파일 없이 Canvas 2D로 직접 그린다.
// 톤: 따뜻한 오후의 동네 정원. 굵은 갈색 외곽선 + 평평한 색으로 스티커처럼.
import { DOG_SIZE, FENCE, WORLD, makeRng, type Side } from './sim.ts';
import { img, opaqueBounds, thickSprite } from './assets.ts';

type Ctx = CanvasRenderingContext2D;

export const INK = '#4a3428'; // 모든 외곽선 색
const { W, H, GROUND } = WORLD;

// 배경 장식 위치는 한 번만 정해 둔다 (매 프레임 흔들리지 않게)
const deco = (() => {
  const rng = makeRng(20261120);
  const tufts = Array.from({ length: 34 }, () => ({ x: rng() * W, s: 0.7 + rng() * 0.6 }));
  const flowers = [
    { x: 58, c: '#f28b82' }, { x: 248, c: '#ffd166' }, { x: 300, c: '#f6a6c1' }, { x: 395, c: '#ffd166' },
    { x: 610, c: '#b4a7f5' }, { x: 668, c: '#f28b82' }, { x: 742, c: '#ffd166' }, { x: 958, c: '#f6a6c1' },
  ].map((f) => ({ ...f, y: GROUND + 14 + rng() * 40, r: 4 + rng() * 2 }));
  const clouds = [
    { x: 160, y: 70, s: 1.1 }, { x: 470, y: 46, s: 0.8 }, { x: 760, y: 92, s: 1.25 }, { x: 1080, y: 60, s: 0.9 },
  ];
  return { tufts, flowers, clouds };
})();

function blob(ctx: Ctx, parts: [number, number, number][]) {
  ctx.beginPath();
  for (const [x, y, r] of parts) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ── 배경 ──────────────────────────────────────────────
export function drawBackground(ctx: Ctx, t: number, wind: number) {
  const bg = img('bg');
  if (bg) {
    ctx.drawImage(bg, 0, 0, W, H);
    drawClouds(ctx, t, wind);
    drawBowl(ctx, 236, GROUND + 6, '#e07a5f', 'bowl-left');
    drawBowl(ctx, 764, GROUND + 6, '#5e8fc2', 'bowl-right');
    return;
  }
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#a9d8ea');
  sky.addColorStop(0.75, '#e6f2e9');
  sky.addColorStop(1, '#fbefd9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 해
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(890, 78, 34, 0, Math.PI * 2);
  ctx.fill();

  drawClouds(ctx, t, wind);

  // 먼 언덕 두 겹
  drawHills(ctx);
}

// 구름: 바람 방향으로 천천히 흘러간다 (배경 그림이 있어도 코드로 그린다)
function drawClouds(ctx: Ctx, t: number, wind: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const c of deco.clouds) {
    const span = W + 300;
    const x = ((((c.x + t * (6 + wind * 9)) % span) + span) % span) - 150;
    const s = c.s;
    blob(ctx, [
      [x, c.y, 22 * s], [x + 24 * s, c.y - 10 * s, 26 * s], [x + 52 * s, c.y, 20 * s], [x + 26 * s, c.y + 6 * s, 22 * s],
    ]);
    ctx.fill();
  }

}

function drawHills(ctx: Ctx) {
  ctx.fillStyle = '#c6e0b4';
  ctx.beginPath();
  ctx.moveTo(0, 420);
  ctx.bezierCurveTo(180, 360, 330, 395, 500, 380);
  ctx.bezierCurveTo(680, 364, 820, 400, W, 372);
  ctx.lineTo(W, GROUND);
  ctx.lineTo(0, GROUND);
  ctx.fill();
  ctx.fillStyle = '#b1d39b';
  ctx.beginPath();
  ctx.moveTo(0, 440);
  ctx.bezierCurveTo(140, 418, 260, 432, 420, 426);
  ctx.bezierCurveTo(600, 420, 760, 440, W, 424);
  ctx.lineTo(W, GROUND);
  ctx.lineTo(0, GROUND);
  ctx.fill();

  drawHouse(ctx, 'left');
  drawHouse(ctx, 'right');

  // 잔디
  ctx.fillStyle = '#93c46e';
  ctx.beginPath();
  ctx.moveTo(0, GROUND + 2);
  for (let x = 0; x <= W; x += 50) ctx.quadraticCurveTo(x + 25, GROUND - 3, x + 50, GROUND + 2);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  ctx.strokeStyle = '#6e9f4f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND + 2);
  for (let x = 0; x <= W; x += 50) ctx.quadraticCurveTo(x + 25, GROUND - 3, x + 50, GROUND + 2);
  ctx.stroke();
  // 잔디 아래쪽은 살짝 진하게
  ctx.fillStyle = '#86b862';
  ctx.fillRect(0, GROUND + 52, W, H - GROUND - 52);

  // 풀 포기
  ctx.strokeStyle = '#6e9f4f';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const tf of deco.tufts) {
    const y = GROUND + 20 + (tf.x % 37);
    ctx.beginPath();
    ctx.moveTo(tf.x - 4 * tf.s, y);
    ctx.lineTo(tf.x - 6 * tf.s, y - 7 * tf.s);
    ctx.moveTo(tf.x, y);
    ctx.lineTo(tf.x, y - 9 * tf.s);
    ctx.moveTo(tf.x + 4 * tf.s, y);
    ctx.lineTo(tf.x + 7 * tf.s, y - 6 * tf.s);
    ctx.stroke();
  }
  // 꽃
  for (const f of deco.flowers) {
    ctx.fillStyle = f.c;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r, f.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 밥그릇 (각자 집 앞)
  drawBowl(ctx, 236, GROUND + 6, '#e07a5f', 'bowl-left');
  drawBowl(ctx, 764, GROUND + 6, '#5e8fc2', 'bowl-right');
}

function drawBowl(ctx: Ctx, x: number, y: number, color: string, sprite: string) {
  const im = img(sprite);
  if (im) {
    ctx.drawImage(im, x - 18, y - 13, 36, 18); // 72×36 그림을 화면 크기 절반으로
    return;
  }
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 8);
  ctx.lineTo(x + 16, y - 8);
  ctx.lineTo(x + 12, y + 2);
  ctx.lineTo(x - 12, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c98f5a';
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 14, 3, 0, Math.PI, 0);
  ctx.fill();
}

function drawHouse(ctx: Ctx, side: Side) {
  const left = side === 'left';
  const wall = left ? '#f6deb5' : '#e3ecd9';
  const roof = left ? '#cf6a4c' : '#5f87ad';
  const x0 = left ? -40 : 830; // 집의 왼쪽 끝
  const w = 210;
  const top = 300;
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';

  // 굴뚝
  ctx.fillStyle = '#b6845d';
  const chx = left ? x0 + 150 : x0 + 40;
  ctx.fillRect(chx, top - 74, 22, 44);
  ctx.strokeRect(chx, top - 74, 22, 44);

  // 벽
  ctx.fillStyle = wall;
  ctx.fillRect(x0, top, w, GROUND - top);
  ctx.strokeRect(x0, top, w, GROUND - top);
  // 벽 아래 띠
  ctx.fillStyle = left ? '#e5c597' : '#cbd9bf';
  ctx.fillRect(x0 + 1.5, GROUND - 16, w - 3, 14);

  // 지붕
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x0 - 18, top + 4);
  ctx.lineTo(x0 + w / 2, top - 80);
  ctx.lineTo(x0 + w + 18, top + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 지붕 기와 줄
  ctx.strokeStyle = 'rgba(74,52,40,0.35)';
  ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    const yy = top - 80 + i * 21;
    const half = ((yy - (top - 80)) / 84) * (w / 2 + 18);
    ctx.beginPath();
    ctx.moveTo(x0 + w / 2 - half + 6, yy);
    ctx.lineTo(x0 + w / 2 + half - 6, yy);
    ctx.stroke();
  }

  // 창문 (따뜻한 불빛)
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  const wx = left ? x0 + 52 : x0 + 108;
  ctx.fillStyle = '#ffe9a8';
  roundRect(ctx, wx, top + 34, 50, 44, 6);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wx + 25, top + 34);
  ctx.lineTo(wx + 25, top + 78);
  ctx.moveTo(wx, top + 56);
  ctx.lineTo(wx + 50, top + 56);
  ctx.stroke();
  // 창틀 화분
  ctx.fillStyle = '#b6845d';
  ctx.fillRect(wx - 4, top + 78, 58, 8);
  ctx.strokeRect(wx - 4, top + 78, 58, 8);
  ctx.fillStyle = '#e07a8f';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(wx + 6 + i * 14, top + 74, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 문 (강아지 쪽)
  const dx = left ? x0 + 128 : x0 + 30;
  ctx.fillStyle = left ? '#8fb3a0' : '#e0a370';
  roundRect(ctx, dx, GROUND - 92, 46, 92, [22, 22, 0, 0]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(left ? dx + 36 : dx + 10, GROUND - 44, 3, 0, Math.PI * 2);
  ctx.fill();

  // 문패 대신 발바닥 자국
  drawPaw(ctx, dx + 23, GROUND - 70, 0.7, 'rgba(74,52,40,0.55)');
}

export function drawPaw(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + 3 * s, 6 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [[-6, -4], [-2, -8], [2, -8], [6, -4]]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, 2.4 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── 울타리 + 풍향 깃발 ────────────────────────────────
export function drawFence(ctx: Ctx, t: number, wind: number) {
  const { x, w, top } = FENCE;
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';

  // 깃대 (울타리 가운데 판자 뒤에 꽂혀 있다)
  const poleX = x + w / 2;
  const poleTop = top - 96;
  ctx.fillStyle = '#e9e1d4';
  ctx.fillRect(poleX - 2.5, poleTop, 5, top - poleTop + 4);
  ctx.strokeRect(poleX - 2.5, poleTop, 5, top - poleTop + 4);
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.arc(poleX, poleTop - 3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 깃발: 바람이 셀수록 길게 펴지고 빨리 펄럭인다. 바람 0이면 축 늘어진다.
  const dir = wind === 0 ? 1 : Math.sign(wind);
  const strength = Math.abs(wind) / 5;
  const len = 26 + strength * 34;
  const droop = (1 - strength) * 30;
  const flap = Math.sin(t * (4 + strength * 10)) * (2 + strength * 4);
  const flagImg = img('flag');
  if (flagImg) {
    // 깃발 그림: 바람 방향으로 뒤집고, 약하면 아래로 처지게 기울이고, 세기만큼 길게 늘인다
    ctx.save();
    ctx.translate(poleX, poleTop + 2);
    ctx.scale(dir, 1);
    ctx.rotate((1 - strength) * 1.0 + Math.sin(t * (4 + strength * 10)) * 0.06);
    const fh = 22 + strength * 6;
    ctx.drawImage(flagImg, 0, 0, len + 10, fh * (1 + flap * 0.01));
    ctx.restore();
  } else {
  ctx.fillStyle = '#e4574a';
  ctx.beginPath();
  ctx.moveTo(poleX, poleTop + 2);
  ctx.quadraticCurveTo(poleX + dir * len * 0.5, poleTop + 2 + flap + droop * 0.4, poleX + dir * len, poleTop + 13 + droop + flap);
  ctx.quadraticCurveTo(poleX + dir * len * 0.5, poleTop + 22 + droop * 0.6 - flap, poleX, poleTop + 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 깃발 줄무늬
  ctx.strokeStyle = '#fff4e6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(poleX + dir * 4, poleTop + 13);
  ctx.quadraticCurveTo(poleX + dir * len * 0.45, poleTop + 13 + droop * 0.5, poleX + dir * len * 0.8, poleTop + 13 + droop * 0.85 + flap * 0.6);
  ctx.stroke();
  }

  // 울타리 그림이 있으면 그걸 쓴다. 그림 속 울타리 부분만 잘라서 판정 높이(top ~ 땅)에 맞춰 늘린다.
  // → 그림이 짧게 그려져 와도 눈에 보이는 울타리와 막히는 높이가 같다.
  const fenceImg = img('fence');
  if (fenceImg) {
    const b = opaqueBounds(fenceImg);
    const drawH = GROUND + 4 - (top - 6);
    const drawW = (b.w / b.h) * drawH; // 그림 비율 그대로 (늘리지 않는다)
    ctx.drawImage(fenceImg, b.x, b.y, b.w, b.h, x + w / 2 - drawW / 2, top - 6, drawW, drawH);
    return;
  }

  // 판자 3장 (높이를 조금씩 달리해서 손으로 박은 느낌)
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  const planks = [
    { px: x - 2, pw: 10, py: top + 6, c: '#d9a86c' },
    { px: x + 7, pw: 10, py: top - 2, c: '#e3b77d' },
    { px: x + 16, pw: 10, py: top + 4, c: '#d4a064' },
  ];
  // 가로대 (판자 뒤)
  ctx.fillStyle = '#c08f58';
  for (const ry of [top + 40, top + 100]) {
    ctx.fillRect(x - 10, ry, w + 20, 10);
    ctx.strokeRect(x - 10, ry, w + 20, 10);
  }
  for (const p of planks) {
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.moveTo(p.px, GROUND + 4);
    ctx.lineTo(p.px, p.py + 8);
    ctx.lineTo(p.px + p.pw / 2, p.py);
    ctx.lineTo(p.px + p.pw, p.py + 8);
    ctx.lineTo(p.px + p.pw, GROUND + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // 못 자국
  ctx.fillStyle = INK;
  for (const p of planks) {
    for (const ry of [top + 45, top + 105]) {
      ctx.beginPath();
      ctx.arc(p.px + p.pw / 2, ry, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── 강아지 ────────────────────────────────────────────
export interface DogPose {
  t: number; // 전체 시간 (초)
  aim: number; // 조준 각도 (도). 머리가 살짝 따라 든다
  hurt: number; // 0~1, 맞은 직후 1에서 줄어든다
  throwing: number; // 0~1, 던진 직후 1에서 줄어든다
  mood: 'idle' | 'happy' | 'sad';
  charging: boolean;
}

const DOGS = {
  left: { // 콩이: 하얗고 동글동글, 축 처진 귀
    fur: '#fffaf1', shade: '#efe4d2', ear: '#f1dfc6', collar: '#e4574a', tag: '#f2c14e',
  },
  right: { // 보리: 갈색, 귀가 쫑긋
    fur: '#c07d45', shade: '#a8693a', ear: '#9c5f33', collar: '#4f8fbf', tag: '#f2c14e', muzzle: '#f3d8b0',
  },
} as const;

function dogSpriteName(side: Side, pose: DogPose): string {
  const who = side === 'left' ? 'kong' : 'bori';
  const state =
    pose.hurt > 0.15 ? 'hurt'
    : pose.mood !== 'idle' ? pose.mood
    : pose.throwing > 0.25 ? 'throw'
    : pose.charging ? 'charge'
    : 'idle';
  return `${who}-${state}`;
}

export function drawDog(ctx: Ctx, side: Side, x: number, pose: DogPose) {
  const sprite = thickSprite(dogSpriteName(side, pose)) ?? thickSprite(`${side === 'left' ? 'kong' : 'bori'}-idle`);
  if (sprite) {
    drawDogSprite(ctx, side, x, pose, sprite);
    return;
  }
  const c = DOGS[side];
  const f = side === 'left' ? 1 : -1;
  const kong = side === 'left';
  const { t } = pose;

  const breathe = Math.sin(t * 2.4 + (kong ? 0 : 1.3)) * 1.2;
  const hop = pose.mood === 'happy' ? Math.abs(Math.sin(t * 7)) * 10 : 0;
  const shake = pose.hurt > 0 ? Math.sin(t * 60) * 4 * pose.hurt : 0;
  const squash = pose.charging ? 0.04 : 0;

  ctx.save();
  ctx.translate(x + shake, GROUND);
  ctx.scale(DOG_SIZE, DOG_SIZE);

  // 그림자
  ctx.fillStyle = 'rgba(60,80,40,0.22)';
  ctx.beginPath();
  ctx.ellipse(2 * f, 2, 36 - hop * 0.6, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -hop);
  ctx.scale(f, 1); // 여기부터는 오른쪽을 보는 강아지로 그린다
  ctx.scale(1 + squash, 1 - squash);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 꼬리
  const wagSpeed = pose.mood === 'happy' ? 22 : pose.mood === 'sad' ? 0 : 5;
  const wag = Math.sin(t * wagSpeed) * (pose.mood === 'sad' ? 0 : 0.35);
  ctx.save();
  ctx.translate(-26, -34);
  ctx.rotate(-0.5 + wag + (pose.mood === 'sad' ? 1.4 : 0));
  ctx.fillStyle = c.fur;
  ctx.beginPath();
  if (kong) {
    // 콩이: 동그랗게 말린 솜꼬리
    blob(ctx, [[-4, -14, 9], [-10, -8, 7]]);
  } else {
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(-18, -6, -14, -26);
    ctx.quadraticCurveTo(-8, -12, 4, -4);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 뒷다리 (몸 뒤)
  ctx.fillStyle = c.shade;
  roundRect(ctx, -22, -16, 13, 17, 5);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, 8, -16, 13, 17, 5);
  ctx.fill();
  ctx.stroke();

  // 몸
  ctx.fillStyle = c.fur;
  ctx.beginPath();
  ctx.ellipse(0, -27 + breathe * 0.5, 31, 21 + breathe * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (!kong) {
    // 보리: 배 쪽 밝은 털
    ctx.fillStyle = DOGS.right.muzzle;
    ctx.beginPath();
    ctx.ellipse(6, -16, 18, 8, 0, 0, Math.PI);
    ctx.fill();
  } else {
    // 콩이: 몽글몽글한 털 표시
    ctx.strokeStyle = 'rgba(74,52,40,0.25)';
    ctx.lineWidth = 2;
    for (const [px, py] of [[-14, -32], [-4, -38], [-18, -22]]) {
      ctx.beginPath();
      ctx.arc(px, py, 5, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
  }

  // 앞다리
  ctx.fillStyle = c.fur;
  roundRect(ctx, -14, -14, 13, 16, 5);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, 16, -14, 13, 16, 5);
  ctx.fill();
  ctx.stroke();

  // 목걸이
  ctx.fillStyle = c.collar;
  ctx.save();
  ctx.translate(16, -40);
  ctx.rotate(0.5);
  roundRect(ctx, -12, -4, 24, 8, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.tag;
  ctx.beginPath();
  ctx.arc(2, 8, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 머리: 조준 각도를 살짝 따라 든다
  const headTilt = -((pose.aim - 35) / 90) * 0.35 - pose.throwing * 0.35 + (pose.mood === 'sad' ? 0.25 : 0);
  ctx.save();
  ctx.translate(20, -60 + breathe * 0.3);
  ctx.rotate(headTilt);

  if (kong) {
    // 축 처진 귀 (뒤쪽 귀 먼저)
    ctx.fillStyle = c.ear;
    ctx.beginPath();
    ctx.ellipse(-14, 4, 8, 15, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 몽실몽실한 머리
    ctx.fillStyle = c.fur;
    blob(ctx, [[0, 0, 20], [-11, -12, 9], [0, -17, 9], [11, -12, 9]]);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 18.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 쫑긋한 귀
    const perk = pose.hurt > 0 ? 0.5 : pose.mood === 'sad' ? 0.8 : 0;
    for (const ex of [-9, 7]) {
      ctx.save();
      ctx.translate(ex, -14);
      ctx.rotate(perk * (ex < 0 ? -1 : 1) * 0.6 + (ex < 0 ? -0.15 : 0.12));
      ctx.fillStyle = c.ear;
      ctx.beginPath();
      ctx.moveTo(-8, 4);
      ctx.quadraticCurveTo(-6, -18, 1, -22);
      ctx.quadraticCurveTo(7, -14, 8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8a598';
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.quadraticCurveTo(-2, -12, 1, -15);
      ctx.quadraticCurveTo(4, -9, 4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = c.fur;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 주둥이
  ctx.fillStyle = kong ? '#fffdf8' : DOGS.right.muzzle;
  ctx.beginPath();
  ctx.ellipse(13, 6, 11, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!kong) ctx.stroke();
  // 코
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(21, 2, 4.2, 3.2, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(20, 0.8, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // 입
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  if (pose.hurt > 0.15 || pose.mood === 'sad') {
    ctx.fillStyle = '#7a3b34';
    ctx.beginPath();
    ctx.ellipse(13, 12, 3.5, pose.hurt > 0.15 ? 4 : 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(9, 10);
    ctx.quadraticCurveTo(12, 13.5, 15, 10.5);
    ctx.quadraticCurveTo(18, 13.5, 21, 9.5);
    ctx.stroke();
    if (pose.mood === 'happy' || pose.charging) {
      ctx.fillStyle = '#ef8a8a';
      ctx.beginPath();
      ctx.ellipse(15, 15, 3.5, 4.5, 0, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 볼터치
  ctx.fillStyle = 'rgba(240,140,140,0.45)';
  ctx.beginPath();
  ctx.ellipse(4, 9, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 눈
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 2.6;
  const blink = (t + (kong ? 0 : 1.7)) % 3.6 < 0.12;
  const ex = 8;
  const ey = -4;
  if (pose.hurt > 0.15) {
    // > < 모양
    ctx.beginPath();
    ctx.moveTo(ex - 4, ey - 4);
    ctx.lineTo(ex + 1, ey);
    ctx.lineTo(ex - 4, ey + 4);
    ctx.stroke();
  } else if (pose.mood === 'happy') {
    ctx.beginPath();
    ctx.arc(ex, ey + 2, 4, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else if (pose.mood === 'sad') {
    ctx.beginPath();
    ctx.arc(ex, ey + 1, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ex - 5, ey - 7);
    ctx.lineTo(ex + 3, ey - 4);
    ctx.stroke();
  } else if (blink) {
    ctx.beginPath();
    ctx.moveTo(ex - 3, ey);
    ctx.lineTo(ex + 3, ey);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(ex, ey, 3, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex + 1, ey - 1.4, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // 콩이 앞머리 한 가닥
  if (kong) {
    ctx.strokeStyle = 'rgba(74,52,40,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-4, -10, 6, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.restore(); // 머리

  ctx.restore();
}

// 조정 포인트: 강아지 그림 크기 (1 = 요청서 크기 그대로). 판정 크기는 sim.ts의 dogHitboxes.
const DOG_SPRITE_SCALE = 1.15 * DOG_SIZE;

// 그림 파일로 그리는 강아지. 240×240 그림의 발바닥 기준점 (120, 236)을 땅에 맞춘다.
function drawDogSprite(ctx: Ctx, side: Side, x: number, pose: DogPose, sprite: CanvasImageSource) {
  const f = side === 'left' ? 1 : -1;
  const { t } = pose;
  const breathe = Math.sin(t * 2.4 + (side === 'left' ? 0 : 1.3)) * 0.012;
  const hop = pose.mood === 'happy' ? Math.abs(Math.sin(t * 7)) * 10 : 0;
  const shake = pose.hurt > 0 ? Math.sin(t * 60) * 4 * pose.hurt : 0;
  const squash = pose.charging ? 0.04 : 0;

  ctx.save();
  ctx.translate(x + shake, GROUND);
  ctx.fillStyle = 'rgba(60,80,40,0.22)';
  ctx.beginPath();
  ctx.ellipse(2 * f, 0, 36 - hop * 0.6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -hop);
  ctx.scale(f * (1 + squash), 1 - squash + breathe);
  const k = DOG_SPRITE_SCALE;
  ctx.drawImage(sprite, -60 * k, -118 * k, 120 * k, 120 * k);
  ctx.restore();
}

// ── 뼈다귀 ────────────────────────────────────────────
// 조정 포인트: 뼈다귀 그림을 판정 크기보다 얼마나 크게 그릴지
const BONE_DRAW_SCALE = 1.15;

export function drawBone(ctx: Ctx, x: number, y: number, rot: number, r: number) {
  const s = (r / 9) * BONE_DRAW_SCALE;
  const im = img('bone');
  if (im) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.drawImage(im, -16, -9, 32, 18); // 64×36 그림 = 보통 뼈다귀 크기
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.lineWidth = 2.5 / s + 0.5;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#fff8ea';
  ctx.beginPath();
  ctx.moveTo(-9, -3);
  ctx.lineTo(9, -3);
  ctx.arc(11, -4.5, 4, Math.PI * 0.85, Math.PI * 0.5, false);
  ctx.arc(11, 4.5, 4, Math.PI * 1.5, Math.PI * 1.15, false);
  ctx.lineTo(-9, 3);
  ctx.arc(-11, 4.5, 4, Math.PI * 1.85, Math.PI * 1.5, false);
  ctx.arc(-11, -4.5, 4, Math.PI * 0.5, Math.PI * 0.15, false);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ── 말풍선 ────────────────────────────────────────────
export function drawBubble(ctx: Ctx, x: number, y: number, text: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 18px "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
  const w = ctx.measureText(text).width + 22;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  roundRect(ctx, x - w / 2, y - 18, w, 32, 14);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 13);
  ctx.lineTo(x, y + 24);
  ctx.lineTo(x + 6, y + 13);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(x - 7, y + 10, 14, 4);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 1);
  ctx.restore();
}

// ── 아이템 아이콘 (아이템 칸에 쓰는 작은 그림) ─────────
export function drawItemIcon(ctx: Ctx, id: string, size: number) {
  ctx.clearRect(0, 0, size, size);
  const im = img(`item-${id}`);
  if (im) {
    ctx.drawImage(im, 0, 0, size, size);
    return;
  }
  ctx.save();
  ctx.scale(size / 48, size / 48);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (id === 'double') {
    drawBone(ctx, 20, 18, -0.5, 8);
    drawBone(ctx, 28, 31, -0.5, 8);
  } else if (id === 'big') {
    drawBone(ctx, 24, 24, -0.6, 13);
  } else if (id === 'calm') {
    // 접는 부채
    ctx.fillStyle = '#f6c3a0';
    ctx.beginPath();
    ctx.moveTo(24, 38);
    ctx.arc(24, 38, 26, Math.PI * 1.18, Math.PI * 1.82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(74,52,40,0.5)';
    ctx.lineWidth = 1.6;
    for (let i = 1; i < 6; i++) {
      const a = Math.PI * (1.18 + (0.64 * i) / 6);
      ctx.beginPath();
      ctx.moveTo(24, 38);
      ctx.lineTo(24 + Math.cos(a) * 25, 38 + Math.sin(a) * 25);
      ctx.stroke();
    }
    ctx.fillStyle = '#e4574a';
    ctx.beginPath();
    ctx.arc(24, 38, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'sniff') {
    // 강아지 코 + 냄새 줄기
    ctx.strokeStyle = 'rgba(74,52,40,0.55)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(8, 34);
    ctx.quadraticCurveTo(14, 8, 34, 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(22, 26);
    ctx.bezierCurveTo(22, 20, 42, 20, 42, 26);
    ctx.bezierCurveTo(42, 34, 35, 38, 32, 38);
    ctx.bezierCurveTo(29, 38, 22, 34, 22, 26);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(28, 26, 2.2, 1.5, 0, 0, Math.PI * 2);
    ctx.ellipse(36, 26, 2.2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
