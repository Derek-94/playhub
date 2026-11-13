import { Link } from 'react-router';
import { Cover } from '../Cover';
import { GAMES } from '../games';

const EMPTY_SLOTS = 2;

export function Home() {
  return (
    <main className="home">
      <section className="intro">
        <p className="kicker">브라우저에서 바로, 설치 없이</p>
        <h1>
          한 판만
          <br />
          하고 갈게요.
        </h1>
        <p className="lede">
          게스트로 바로 시작해요. 기록은 자동으로 랭킹에 올라가요.
        </p>
      </section>

      <section>
        <div className="section-head">
          <h2>게임</h2>
          <span className="mono muted">{String(GAMES.length).padStart(2, '0')}개</span>
        </div>
        <ul className="shelf">
          {GAMES.map((g, i) => (
            <li key={g.id}>
              <Link to={`/play/${g.id}`} className="card">
                <Cover kind={g.cover} />
                <div className="card-body">
                  <div className="card-meta">
                    <span className="mono">No.{String(i + 1).padStart(2, '0')}</span>
                    <span>{g.genre}</span>
                  </div>
                  <h3>{g.title}</h3>
                  <p>{g.summary}</p>
                  <span className="cta">플레이 →</span>
                </div>
              </Link>
            </li>
          ))}
          {Array.from({ length: EMPTY_SLOTS }, (_, i) => (
            <li key={`slot-${i}`} className="slot">
              <span className="mono">No.{String(GAMES.length + i + 1).padStart(2, '0')}</span>
              <span>준비 중</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
