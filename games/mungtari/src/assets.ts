/// <reference types="vite/client" />
// assets/ 폴더의 그림·소리를 불러온다.
// 파일이 없거나 아직 로딩 중이면 null을 돌려주고, 그리는 쪽은 기존 코드 그림으로 대신 그린다.
// → 그림 파일을 하나씩 바꿔 끼우거나 지워도 게임은 그대로 돈다.

// Vite가 빌드할 때 assets/ 안의 파일 주소를 모아 준다 (없는 파일은 목록에 없을 뿐 에러 아님)
const urls = import.meta.glob('../assets/*.{png,mp3}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const urlOf = (file: string): string | undefined => urls[`../assets/${file}`];

const images = new Map<string, HTMLImageElement>();

// 이름만 주면 된다: img('kong-idle') → assets/kong-idle.png
export function img(name: string): HTMLImageElement | null {
  let el = images.get(name);
  if (!el) {
    const url = urlOf(`${name}.png`);
    if (!url) return null;
    el = new Image();
    el.src = url;
    images.set(name, el);
  }
  return el.complete && el.naturalWidth > 0 ? el : null;
}

// 시작할 때 미리 불러 둔다 (첫 프레임에 깜빡이지 않게)
export function preloadImages(onEach?: () => void) {
  for (const key of Object.keys(urls)) {
    const m = key.match(/\/([^/]+)\.png$/);
    if (!m) continue;
    img(m[1]);
    images.get(m[1])?.addEventListener('load', () => onEach?.(), { once: true });
  }
}

// ── 소리 ──────────────────────────────────────────────
export type Sfx = 'throw' | 'hit' | 'yelp' | 'fence' | 'win' | 'lose';
const SOUND_KEY = 'mungtari.sound';
let soundOn = readSoundPref();
let bgm: HTMLAudioElement | null = null;

function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export const isSoundOn = () => soundOn;

export function setSoundOn(on: boolean) {
  soundOn = on;
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* 저장 못 해도 이번 판에는 적용된다 */
  }
  if (on) startBgm();
  else bgm?.pause();
}

// ── 조정 포인트: 소리 크기 ─────────────────────────────
const VOLUME: Record<Sfx | 'bgm', number> = { throw: 0.6, hit: 0.7, yelp: 0.7, fence: 0.6, win: 0.7, lose: 0.7, bgm: 0.3 };

export function play(name: Sfx) {
  if (!soundOn) return;
  const url = urlOf(`sfx-${name}.mp3`);
  if (!url) return;
  const a = new Audio(url);
  a.volume = VOLUME[name];
  a.play().catch(() => {});
}

// 브라우저는 사용자가 한 번 클릭한 뒤에만 소리를 틀어 준다 → 난이도 버튼 클릭 때 부른다
export function startBgm() {
  if (!soundOn) return;
  const url = urlOf('bgm.mp3');
  if (!url) return;
  if (!bgm) {
    bgm = new Audio(url);
    bgm.loop = true;
    bgm.volume = VOLUME.bgm;
  }
  bgm.play().catch(() => {});
}

// 그림에서 실제로 칠해진 부분(투명 아닌 영역)의 사각형. 그림마다 여백이 달라도 맞춰 그리려고 쓴다.
const boundsCache = new Map<HTMLImageElement, { x: number; y: number; w: number; h: number }>();
export function opaqueBounds(im: HTMLImageElement) {
  let b = boundsCache.get(im);
  if (b) return b;
  const c = document.createElement('canvas');
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  b = x1 < 0 ? { x: 0, y: 0, w: c.width, h: c.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  boundsCache.set(im, b);
  return b;
}

// ── 강아지 그림 테두리 굵게 ────────────────────────────
// 그림의 진한 선(테두리·눈·입)만 골라서 주변으로 살짝 번지게 찍어 굵게 만든다. 디자인은 그대로.
// 조정 포인트: 240px 그림 기준으로 선을 한쪽에 몇 px씩 키울지 (0이면 원본 그대로)
export const OUTLINE_GROW = 1.2;
const thickCache = new Map<string, HTMLCanvasElement>();

export function thickSprite(name: string): CanvasImageSource | null {
  const im = img(name);
  if (!im) return null;
  if (OUTLINE_GROW <= 0) return im;
  const hit = thickCache.get(name);
  if (hit) return hit;

  const W = im.naturalWidth;
  const H = im.naturalHeight;
  const base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  const g = base.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(im, 0, 0);
  const src = g.getImageData(0, 0, W, H);

  // 진한 선만 남긴 층 (빨강 반다나·갈색 털처럼 한 채널이라도 밝은 색은 빼고, 셋 다 어두운 색만)
  const ink = new ImageData(W, H);
  for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i], gr = src.data[i + 1], b = src.data[i + 2], a = src.data[i + 3];
    if (a > 120 && Math.max(r, gr, b) < 105) {
      ink.data[i] = r;
      ink.data[i + 1] = gr;
      ink.data[i + 2] = b;
      ink.data[i + 3] = a;
    }
  }
  const inkCanvas = document.createElement('canvas');
  inkCanvas.width = W;
  inkCanvas.height = H;
  inkCanvas.getContext('2d')!.putImageData(ink, 0, 0);

  // 원본 위에 선 층을 원 모양으로 조금씩 옮겨 찍는다 → 선이 사방으로 굵어진다
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const o = out.getContext('2d')!;
  o.drawImage(im, 0, 0);
  const grow = (OUTLINE_GROW * W) / 240;
  for (const rad of [grow, grow / 2]) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      o.drawImage(inkCanvas, Math.cos(a) * rad, Math.sin(a) * rad);
    }
  }
  thickCache.set(name, out);
  return out;
}
