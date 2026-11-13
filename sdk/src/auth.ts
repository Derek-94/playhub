// 로그인 방식은 이 파일에만 모은다.
// 이메일/Google 로그인을 붙일 때도 여기에 함수를 추가하고, setSession()만 호출하면
// leaderboard.ts 쪽은 손대지 않아도 된다.
import { client, setSession } from './client';

const DEVICE_ID_KEY = 'playhub.deviceId';

// 브라우저마다 고정된 ID. 같은 브라우저면 새로고침해도 같은 게스트 계정이 된다.
function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export interface PlayerInfo {
  userId: string;
  username: string;
}

export async function loginGuest(): Promise<PlayerInfo> {
  // create=true: 처음 보는 deviceId면 계정을 만들고, 아니면 그 계정으로 로그인
  const session = await client.authenticateDevice(getDeviceId(), true);
  setSession(session);
  return { userId: session.user_id ?? '', username: session.username ?? '' };
}
