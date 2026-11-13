import { useEffect, useState } from 'react';
import { loginGuest, type PlayerInfo } from 'playhub-sdk';

// 로그인은 앱 전체에서 한 번만. 여러 컴포넌트가 불러도 같은 Promise를 공유한다.
let loginOnce: Promise<PlayerInfo> | null = null;
export function ensureLogin() {
  loginOnce ??= loginGuest().catch((e) => {
    loginOnce = null; // 실패하면 다음에 다시 시도할 수 있게
    throw e;
  });
  return loginOnce;
}

export type PlayerState =
  | { status: 'loading' }
  | { status: 'ready'; player: PlayerInfo }
  | { status: 'offline' };

export function usePlayer(): PlayerState {
  const [state, setState] = useState<PlayerState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    ensureLogin()
      .then((player) => alive && setState({ status: 'ready', player }))
      .catch(() => alive && setState({ status: 'offline' }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
