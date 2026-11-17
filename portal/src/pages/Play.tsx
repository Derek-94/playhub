import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { findGame } from '../games';
import { Ranking } from '../Ranking';

export function Play() {
  const { gameId } = useParams();
  const game = findGame(gameId);
  const frame = useRef<HTMLIFrameElement>(null);
  // 게임이 자기 화면 높이를 알려 주면(playhub:resize) iframe 높이를 거기에 맞춘다. 안 알려 주면 CSS 기본 높이.
  const [frameHeight, setFrameHeight] = useState<number | null>(null);

  useEffect(() => {
    setFrameHeight(null);
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'playhub:resize' && typeof e.data.height === 'number' && e.data.height > 0) {
        setFrameHeight(Math.ceil(e.data.height));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [gameId]);

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
      <div className={`play-grid${game.orientation === 'landscape' ? ' landscape' : ''}`}>
        <div className="stage">
          <iframe
            key={game.id} // 게임이 바뀌면 iframe을 새로 만든다 (이전 게임의 높이 알림이 섞이지 않게)
            ref={frame}
            src={game.path}
            title={game.title}
            style={frameHeight ? { height: frameHeight } : undefined}
            // 키보드 입력이 바로 게임으로 가도록 로드되면 포커스를 넘긴다.
            onLoad={() => frame.current?.contentWindow?.focus()}
          />
        </div>
        <Ranking gameId={game.id} />
      </div>
    </main>
  );
}
