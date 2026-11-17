import list from './games.json';

// games.json 한 줄 = 포털에 올라가는 게임 하나.
// id는 서버 리더보드 ID와 같아야 랭킹이 연결된다.
export interface Game {
  id: string;
  title: string;
  genre: string;
  summary: string;
  controls: string;
  path: string;
  cover: string;
  // 게임 화면 방향. landscape(가로)면 플레이 화면에서 게임을 넓게 펼치고 랭킹을 아래로 내린다.
  orientation?: 'portrait' | 'landscape';
}

export const GAMES = list as Game[];

export const findGame = (id: string | undefined) => GAMES.find((g) => g.id === id);
