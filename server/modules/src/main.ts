// Nakama가 켜질 때 한 번 실행되는 서버 모듈.
// 리더보드는 클라이언트에서 만들 수 없어서, 여기서 미리 만들어 둔다.

// 게임이 추가되면 여기에 ID만 늘리면 된다.
const LEADERBOARD_IDS = ['game-2048'];

let InitModule: nkruntime.InitModule = function (ctx, logger, nk, initializer) {
  for (const id of LEADERBOARD_IDS) {
    nk.leaderboardCreate(
      id,
      false, // authoritative=false: 클라이언트(게임)가 직접 점수를 제출할 수 있음
      nkruntime.SortOrder.DESCENDING, // 점수 높은 순
      nkruntime.Operator.BEST // 유저별 최고 점수만 남김
    );
    logger.info('리더보드 준비 완료: %s', id);
  }
};
