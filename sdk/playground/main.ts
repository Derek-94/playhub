// 게임/포털과 똑같이 패키지 이름으로 import 한다.
import { loginGuest, submitScore, getTop } from 'playhub-sdk';
import 'playhub-sdk/ui'; // <playhub-ranking> 태그 등록

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scoreInput = $<HTMLInputElement>('score');
const gameIdInput = $<HTMLInputElement>('gameId');

scoreInput.value = String(Math.floor(Math.random() * 5000));

function log(msg: string) {
  const el = $('log');
  el.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  el.scrollTop = el.scrollHeight;
}

// 버튼 클릭 → 함수 실행 → 성공/실패를 로그에 남긴다.
function bind(id: string, run: () => Promise<string>) {
  $(id).addEventListener('click', async () => {
    try {
      log(`✅ ${await run()}`);
    } catch (e) {
      log(`❌ ${e instanceof Error ? e.message : JSON.stringify(e)}`);
    }
  });
}

bind('login', async () => {
  const me = await loginGuest();
  $('me').innerHTML = `게스트 <b>${me.username}</b> <small>(${me.userId})</small>`;
  return `loginGuest 성공: ${me.username}`;
});

bind('submit', async () => {
  const score = Number(scoreInput.value);
  await submitScore(gameIdInput.value, score);
  scoreInput.value = String(Math.floor(Math.random() * 5000));
  return `submitScore(${gameIdInput.value}, ${score}) 성공`;
});

bind('top', async () => {
  const top = await getTop(gameIdInput.value);
  $('rank').innerHTML = top
    .map((r) => `<tr><td>${r.rank}</td><td>${r.name}</td><td>${r.score}</td></tr>`)
    .join('');
  return `getTop: ${top.length}건`;
});
