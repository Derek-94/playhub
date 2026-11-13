import { useRef } from 'react';
import { Link, useParams } from 'react-router';
import { findGame } from '../games';
import { Ranking } from '../Ranking';

export function Play() {
  const { gameId } = useParams();
  const game = findGame(gameId);
  const frame = useRef<HTMLIFrameElement>(null);

  if (!game) {
    return (
      <main className="play-missing">
        <p>없는 게임이에요.</p>
        <Link to="/" className="back">← 목록으로</Link>
      </main>
    );
  }

  return (
    <main className="play">
      <div className="play-bar">
        <Link to="/" className="back">← 목록</Link>
        <h1>{game.title}</h1>
        <span className="mono muted controls">{game.controls}</span>
      </div>
      <div className="play-grid">
        <div className="stage">
          <iframe
            ref={frame}
            src={game.path}
            title={game.title}
            // 키보드 입력이 바로 게임으로 가도록 로드되면 포커스를 넘긴다.
            onLoad={() => frame.current?.contentWindow?.focus()}
          />
        </div>
        <Ranking gameId={game.id} />
      </div>
    </main>
  );
}
