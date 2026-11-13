import { defineConfig } from 'vite';

export default defineConfig({
  // 나중에 포털의 /games/cosmic-merge/ 같은 하위 폴더에 넣어도 동작하도록 상대 경로로 빌드
  base: './',
});
