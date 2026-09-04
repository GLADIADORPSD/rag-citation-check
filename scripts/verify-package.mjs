import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'rag-citation-check-'));
const packageDirectory = join(temporaryRoot, 'package');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const node = process.execPath;

const run = (command, arguments_, cwd) => {
  execFileSync(command, arguments_, {
    cwd,
    stdio: 'inherit',
  });
};

try {
  mkdirSync(packageDirectory);
  run('pnpm', ['pack', '--pack-destination', packageDirectory], root);

  const tarballs = readdirSync(packageDirectory).filter((file) => file.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new Error(`Expected one package tarball, found ${tarballs.length}.`);
  }

  const tarball = join(packageDirectory, tarballs[0]);

  for (const moduleType of ['module', 'commonjs']) {
    const consumerDirectory = join(temporaryRoot, moduleType);
    mkdirSync(consumerDirectory);
    writeFileSync(
      join(consumerDirectory, 'package.json'),
      `${JSON.stringify({ name: `smoke-${moduleType}`, private: true, type: moduleType }, null, 2)}\n`,
    );

    run(
      npm,
      ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tarball],
      consumerDirectory,
    );

    const expression =
      moduleType === 'module'
        ? "await import('rag-citation-check')"
        : "require('rag-citation-check')";
    const arguments_ =
      moduleType === 'module'
        ? ['--input-type=module', '--eval', expression]
        : ['--eval', expression];

    run(node, arguments_, consumerDirectory);
  }
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
