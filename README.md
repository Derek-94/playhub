# PlayHub

브라우저에서 바로 하는 웹 게임 포털. 게스트로 플레이하면 점수가 랭킹에 올라간다.

```
playhub/
├─ server/            Nakama + Postgres (Docker)
│  └─ modules/        Nakama 서버 모듈 (TypeScript → build/index.js)
├─ sdk/               playhub-sdk: 게임·포털이 쓰는 Nakama 래퍼
│  └─ playground/     SDK 함수 테스트 페이지
├─ games/
│  └─ cosmic-merge/   게임 (Vite + TS)
├─ portal/            포털 웹 (Vite + React)
└─ scripts/           build-games.mjs: 게임을 포털 안으로 빌드
```

## 준비물

- **Node 22** (`.nvmrc`). nvm을 쓰면 프로젝트 폴더에서 `nvm use`
- **Docker Desktop** 실행 중

## 처음 실행하기

순서대로 한 번씩.

```bash
npm install
```

```bash
npm run build -w server/modules
```

```bash
npm run server:up
```

```bash
npm run dev
```

브라우저에서 http://localhost:5173 을 열면 포털이 뜬다.

| 단계 | 하는 일 |
|---|---|
| `npm install` | 모든 workspace 패키지 설치 |
| `build -w server/modules` | 서버 모듈 TS → `server/modules/build/index.js`. Nakama는 이 JS 파일만 읽는다. **Docker보다 먼저** 해야 리더보드가 생성된다 |
| `server:up` | Postgres + Nakama 컨테이너 실행 |
| `dev` | 게임을 `portal/public/games/`로 빌드한 뒤 포털 개발 서버 실행 |

> 사내망에서 `npm install`이 `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`로 실패하면:
> `NODE_OPTIONS=--use-system-ca npm install`

## 자주 쓰는 명령

| 명령 | 용도 |
|---|---|
| `npm run dev` | 게임 빌드 + 포털 실행 (http://localhost:5173) |
| `npm run build:games` | 게임 코드 수정 후 포털에 반영 |
| `npm run dev -w cosmic-merge` | 게임만 단독 실행 (http://localhost:5181) |
| `npm run dev -w sdk` | SDK playground (http://localhost:5180) |
| `npm run server:up` / `server:down` | Docker 서버 올리기 / 내리기 (데이터 유지) |
| `npm run server:restart` | Nakama만 재시작 (서버 모듈 다시 빌드한 뒤) |
| `npm run server:logs` | Nakama 로그 보기 |
| `npm run server:ps` | 컨테이너 상태 확인 |

### 서버 모듈을 고쳤을 때

```bash
npm run build -w server/modules && npm run server:restart
```

### DB까지 완전히 초기화

계정·랭킹 데이터가 **영구 삭제**된다.

```bash
docker compose -f server/docker-compose.yml down -v
```

## 로컬 주소

| 주소 | 내용 |
|---|---|
| http://localhost:5173 | 포털 |
| http://localhost:7351 | Nakama 관리 콘솔 (admin / password, 로컬 전용) |
| http://localhost:7350 | Nakama API (SDK가 사용) |

## 동작 구조

1. 포털이 `games.json`으로 게임 목록을 그린다.
2. 플레이 화면은 게임을 `<iframe>`으로 띄운다. 게임은 포털과 같은 주소(`/games/...`)에서 열려서 localStorage를 공유하고, 그래서 **같은 게스트 계정**을 쓴다.
3. 게임은 시작할 때 `loginGuest()`, 게임 오버 때 `submitScore()`를 호출한다.
4. 점수를 등록한 게임은 `postMessage({ type: 'playhub:score-submitted' })`로 포털에 알린다. 포털은 그 신호를 받아 `getTop()`으로 랭킹을 다시 조회한다.

### playhub-sdk

```ts
import { loginGuest, submitScore, getTop } from 'playhub-sdk';

const me = await loginGuest();              // { userId, username }
await submitScore('cosmic-merge', 1234);    // 사용자별 최고 점수만 유지
const top = await getTop('cosmic-merge');   // [{ rank, name, score }]
```

게스트는 브라우저별 `deviceId`(localStorage `playhub.deviceId`)로 식별한다. 다른 브라우저나 다른 포트에서는 다른 게스트가 된다.

## 게임 추가하기

1. `games/<게임-id>/`에 Vite 프로젝트를 만든다. `vite.config.ts`에 `base: './'`를 넣고, `package.json`에 `"playhub-sdk": "*"` 의존성을 추가한다.
2. `server/modules/src/main.ts`의 `LEADERBOARD_IDS`에 `<게임-id>`를 추가한다.
3. `portal/src/games.json`에 게임 정보를 한 줄 추가한다. `id`는 리더보드 ID와 같아야 한다. 썸네일(`cover`)은 `portal/src/styles.css`의 `.cover-<cover>`로 그린다.
4. `npm install` → 서버 모듈 빌드 + 재시작 → `npm run dev`.
