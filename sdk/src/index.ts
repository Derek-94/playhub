// playhub-sdk — 데이터 층(로그인·점수·랭킹). UI가 필요하면 'playhub-sdk/ui'를 따로 import.
export { loginGuest, getCurrentPlayer, LOGGED_IN_EVENT } from './auth';
export { submitScore, getTop, SCORE_SUBMITTED_EVENT } from './leaderboard';
export type { RankEntry } from './leaderboard';
export type { PlayerInfo } from './auth';
