// <playhub-ranking> — 어느 게임에든 태그 하나로 붙는 랭킹 표.
//
//   <playhub-ranking game-id="cosmic-merge" limit="5"></playhub-ranking>
//
// - Shadow DOM이라 게임 CSS와 서로 영향을 주지 않는다.
// - 색·글꼴은 CSS 변수로 바꾼다: --playhub-bg, --playhub-fg, --playhub-muted,
//   --playhub-accent, --playhub-accent-fg, --playhub-line, --playhub-font, --playhub-radius
// - 로그인되면, 그리고 같은 게임 점수가 제출되면 스스로 다시 불러온다.
import {
  LOGGED_IN_EVENT,
  SCORE_SUBMITTED_EVENT,
  getCurrentPlayer,
  getTop,
  type RankEntry,
} from '../index';

const STYLE = `
:host {
  display: block;
  font-family: var(--playhub-font, system-ui, -apple-system, sans-serif);
  color: var(--playhub-fg, #16140f);
  background: var(--playhub-bg, #fff);
  border: 1px solid var(--playhub-line, rgba(0,0,0,.12));
  border-radius: var(--playhub-radius, 10px);
  overflow: hidden;
  font-size: 14px;
}
.head { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--playhub-line, rgba(0,0,0,.12)); }
.head b { font-size: 13px; }
button { font: inherit; font-size: 12px; color: var(--playhub-muted, #6b665c); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
ol { list-style: none; margin: 0; padding: 0; }
li { display: grid; grid-template-columns: 26px 1fr auto; gap: 8px; align-items: center; padding: 8px 14px; }
li + li { border-top: 1px solid var(--playhub-line, rgba(0,0,0,.08)); }
.rank, .score { font-variant-numeric: tabular-nums; font-weight: 700; }
.rank { color: var(--playhub-muted, #6b665c); }
li:nth-child(-n+3) .rank { color: var(--playhub-accent, #ff4a1c); }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
li.me { background: var(--playhub-accent, #ff4a1c); color: var(--playhub-accent-fg, #fff); }
li.me .rank { color: inherit; }
.note { padding: 18px 14px; color: var(--playhub-muted, #6b665c); }
`;

type View =
  | { kind: 'login' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ok'; rows: RankEntry[] };

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export class PlayhubRanking extends HTMLElement {
  static observedAttributes = ['game-id', 'limit', 'heading'];

  private root = this.attachShadow({ mode: 'open' });
  private view: View = { kind: 'loading' };
  private seq = 0; // 늦게 도착한 이전 응답을 무시하기 위한 번호

  private onLogin = () => this.refresh();
  private onSubmit = (e: Event) => {
    if ((e as CustomEvent).detail?.gameId === this.gameId) this.refresh();
  };

  get gameId() {
    return this.getAttribute('game-id') ?? '';
  }
  get limit() {
    return Number(this.getAttribute('limit') ?? 5) || 5;
  }

  connectedCallback() {
    window.addEventListener(LOGGED_IN_EVENT, this.onLogin);
    window.addEventListener(SCORE_SUBMITTED_EVENT, this.onSubmit);
    this.refresh();
  }

  disconnectedCallback() {
    window.removeEventListener(LOGGED_IN_EVENT, this.onLogin);
    window.removeEventListener(SCORE_SUBMITTED_EVENT, this.onSubmit);
  }

  attributeChangedCallback() {
    if (this.isConnected) this.refresh();
  }

  /** 랭킹을 다시 불러온다. 직접 호출해도 된다. */
  async refresh() {
    const id = ++this.seq;
    if (!this.gameId) return;
    if (!getCurrentPlayer()) {
      this.set({ kind: 'login' });
      return;
    }
    if (this.view.kind !== 'ok') this.set({ kind: 'loading' });
    try {
      const rows = await getTop(this.gameId, this.limit);
      if (id === this.seq) this.set({ kind: 'ok', rows });
    } catch {
      if (id === this.seq) this.set({ kind: 'error' });
    }
  }

  private set(view: View) {
    this.view = view;
    this.render();
  }

  private render() {
    const heading = escape(this.getAttribute('heading') ?? `랭킹 TOP ${this.limit}`);
    const me = getCurrentPlayer()?.userId;
    let body: string;
    switch (this.view.kind) {
      case 'login':   body = '<p class="note">로그인하면 랭킹이 보여요</p>'; break;
      case 'loading': body = '<p class="note">불러오는 중</p>'; break;
      case 'error':   body = '<p class="note">랭킹을 불러오지 못했어요</p>'; break;
      case 'ok':
        body = this.view.rows.length === 0
          ? '<p class="note">아직 기록 없음</p>'
          : `<ol>${this.view.rows
              .map((r) => `<li class="${r.userId === me ? 'me' : ''}" part="row">
                  <span class="rank">${r.rank}</span>
                  <span class="name">${escape(r.name)}</span>
                  <span class="score">${r.score.toLocaleString()}</span>
                </li>`)
              .join('')}</ol>`;
    }
    this.root.innerHTML = `<style>${STYLE}</style>
      <div class="head"><b>${heading}</b><button type="button">새로고침</button></div>
      ${body}`;
    this.root.querySelector('button')!.addEventListener('click', () => this.refresh());
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'playhub-ranking': PlayhubRanking;
  }
}
