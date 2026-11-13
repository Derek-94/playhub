import { Link, Outlet } from 'react-router';
import { usePlayer } from './player';

export function Layout() {
  const me = usePlayer();
  return (
    <div className="shell">
      <header className="masthead">
        <Link to="/" className="wordmark">
          PLAY<span>HUB</span>
        </Link>
        <div className="who">
          {me.status === 'loading' && <span className="muted">접속 중</span>}
          {me.status === 'offline' && <span className="warn">서버 연결 안 됨</span>}
          {me.status === 'ready' && (
            <>
              <span className="tag">GUEST</span>
              <span className="mono">{me.player.username}</span>
            </>
          )}
        </div>
      </header>
      <Outlet />
      <footer className="colophon">
        <span>PlayHub · CCL 8기</span>
        <span className="mono">S1 build</span>
      </footer>
    </div>
  );
}
