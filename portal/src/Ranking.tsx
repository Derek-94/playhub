import { useCallback, useEffect, useState } from 'react';
import { getTop, type RankEntry } from 'playhub-sdk';
import { ensureLogin, usePlayer } from './player';

type Load = { status: 'loading' } | { status: 'ok'; rows: RankEntry[]; at: Date } | { status: 'error' };

export function Ranking({ gameId }: { gameId: string }) {
  const me = usePlayer();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [flash, setFlash] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await ensureLogin();
      const rows = await getTop(gameId, 10);
      setLoad({ status: 'ok', rows, at: new Date() });
    } catch {
      setLoad({ status: 'error' });
    }
  }, [gameId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 게임(iframe)이 점수를 등록하면 알려준다 → 다시 조회
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      if (e.data?.type !== 'playhub:score-submitted' || e.data.gameId !== gameId) return;
      refresh().then(() => {
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [gameId, refresh]);

  const myName = me.status === 'ready' ? me.player.username : null;

  return (
    <aside className={`board${flash ? ' flash' : ''}`}>
      <div className="board-head">
        <h2>랭킹</h2>
        <button type="button" className="link" onClick={refresh}>
          새로고침
        </button>
      </div>

      {load.status === 'loading' && <p className="board-note">불러오는 중</p>}
      {load.status === 'error' && <p className="board-note warn">랭킹을 불러오지 못했어요</p>}
      {load.status === 'ok' && load.rows.length === 0 && (
        <p className="board-note">아직 기록 없음. 첫 기록을 남겨 보세요.</p>
      )}
      {load.status === 'ok' && load.rows.length > 0 && (
        <ol className="rows">
          {load.rows.map((r) => (
            <li key={r.rank} className={r.name === myName ? 'me' : undefined}>
              <span className="rank mono">{r.rank}</span>
              <span className="name">
                {r.name}
                {r.name === myName && <em>나</em>}
              </span>
              <span className="score mono">{r.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}

      {load.status === 'ok' && (
        <p className="board-foot mono muted">
          {load.at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 기준 · TOP 10
        </p>
      )}
    </aside>
  );
}
