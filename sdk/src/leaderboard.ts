import { client, requireSession } from './client';

export interface RankEntry {
  rank: number;
  name: string;
  score: number;
}

// gameId는 서버 모듈에서 만든 리더보드 ID와 같아야 한다. (예: 'game-2048')
export async function submitScore(gameId: string, score: number): Promise<void> {
  await client.writeLeaderboardRecord(requireSession(), gameId, {
    // Nakama 점수는 정수만 받고, nakama-js는 큰 정수 보존을 위해 문자열로 보낸다.
    score: String(Math.floor(score)),
  });
}

export async function getTop(gameId: string, limit = 10): Promise<RankEntry[]> {
  const res = await client.listLeaderboardRecords(requireSession(), gameId, undefined, limit);
  // Nakama 응답에서 화면에 필요한 값만 남긴다.
  return (res.records ?? []).map((r) => ({
    rank: Number(r.rank),
    name: r.username ?? '',
    score: Number(r.score),
  }));
}
