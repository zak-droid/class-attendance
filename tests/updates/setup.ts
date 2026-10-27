import { execFileSync } from 'node:child_process';
export default function setup() {
  for (const version of ['a', 'b']) execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'tests/e2e/vite.config.ts', '--outDir', `work/update-${version}`], {
    env: { ...process.env, APP_BUILD_ID: `update-${version}` }, stdio: 'inherit',
  });
}
