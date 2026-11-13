// playhub-sdk/ui — 선택형 UI 층. import만 하면 <playhub-ranking> 태그가 등록된다.
//
//   import 'playhub-sdk/ui';
//   <playhub-ranking game-id="cosmic-merge" limit="5"></playhub-ranking>
//
// 데이터 층('playhub-sdk')과 같은 모듈을 쓰므로 로그인 세션도 공유한다.
import { PlayhubRanking } from './ranking';

// 같은 페이지에서 두 번 import돼도 에러 나지 않게
if (!customElements.get('playhub-ranking')) {
  customElements.define('playhub-ranking', PlayhubRanking);
}

export { PlayhubRanking };
