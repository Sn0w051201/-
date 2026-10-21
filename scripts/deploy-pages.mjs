import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const run = (args, cwd = process.cwd(), extra = {}) => execFileSync(args[0], args.slice(1), { cwd, stdio: 'inherit', ...extra });
const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
const repo = remote.replace(/\.git$/, '').split(/[/:]/).pop();
if (!repo || !/^[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Cannot determine safe repository path');
run(['npm', 'run', 'build'], process.cwd(), { env: { ...process.env, DEPLOY_BASE_PATH: `/${repo}/`, VITE_DATA_MODE: 'mock', VITE_CLOUDBASE_ENV_ID: '' } });
const refs = execFileSync('git', ['ls-remote', '--heads', 'origin', 'gh-pages'], { encoding: 'utf8' }).trim();
const temp = mkdtempSync(join(tmpdir(), 'moodnomad-pages-'));
try {
  if (refs) {
    run(['git', 'clone', '--single-branch', '--branch', 'gh-pages', '--depth', '1', remote, temp]);
    for (const name of readdirSync(temp)) if (name !== '.git') rmSync(join(temp, name), { recursive: true, force: true });
  } else {
    run(['git', 'init', '--initial-branch=gh-pages', temp]);
    run(['git', 'remote', 'add', 'origin', remote], temp);
  }
  cpSync(join(process.cwd(), 'dist'), temp, { recursive: true });
  writeFileSync(join(temp, '.nojekyll'), '');
  run(['git', 'add', '--all'], temp);
  const changed = execFileSync('git', ['status', '--porcelain'], { cwd: temp, encoding: 'utf8' });
  if (!changed.trim()) { console.log('Deployment files already up to date.'); }
  else { run(['git', 'commit', '-m', 'Deploy MoodNomad web demo'], temp); run(['git', 'push', 'origin', 'HEAD:gh-pages'], temp); }
} finally { rmSync(temp, { recursive: true, force: true }); }
