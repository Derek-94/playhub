// games/* 를 각각 빌드해서 portal/public/games/<이름>/ 에 넣는다.
// 포털과 게임이 같은 주소에서 열려야 localStorage(=게스트 계정)를 같이 쓴다.
import { execSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const gamesDir = join(root, 'games');

for (const name of readdirSync(gamesDir)) {
  const dir = join(gamesDir, name);
  if (!existsSync(join(dir, 'package.json'))) continue;
  const outDir = join(root, 'portal/public/games', name);
  console.log(`\n▶ ${name} → portal/public/games/${name}`);
  execSync(`npx vite build "${dir}" --outDir "${outDir}" --emptyOutDir`, { stdio: 'inherit', cwd: root });
}
