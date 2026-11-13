// Nakama 연결 정보와 로그인 세션을 한 곳에서 관리한다.
// 게임/포털 코드는 이 파일을 몰라도 되고, index.ts의 함수만 쓴다.
import { Client, Session } from '@heroiclabs/nakama-js';

// 로컬 개발용 Nakama 주소. 배포(S3) 때는 여기만 바꾸면 된다.
const SERVER_KEY = 'defaultkey';
const HOST = '127.0.0.1';
const PORT = '7350';
const USE_SSL = false;

export const client = new Client(SERVER_KEY, HOST, PORT, USE_SSL);

let session: Session | null = null;

export function setSession(next: Session) {
  session = next;
}

export function getSession(): Session | null {
  return session;
}

export function requireSession(): Session {
  if (!session) {
    throw new Error('[playhub-sdk] 로그인이 필요해요. loginGuest()를 먼저 호출하세요.');
  }
  return session;
}
