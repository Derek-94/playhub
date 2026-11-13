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
}

export const GAMES: Game[] = list;

export const findGame = (id: string | undefined) => GAMES.find((g) => g.id === id);
