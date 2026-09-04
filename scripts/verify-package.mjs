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

const expectedFiles = [
  'dist/index.cjs',
  'dist/index.cjs.map',
  'dist/index.d.cts',
  'dist/index.d.ts',
  'dist/index.js',
  'dist/index.js.map',
  'LICENSE',
  'package.json',
  'README.md',
];

try {
  const dryRun = execFileSync('pnpm', ['pack', '--json', '--dry-run'], {
    cwd: root,
    encoding: 'utf8',
  });
  const manifest = JSON.parse(dryRun);
  const packedFiles = manifest.files.map(({ path }) => path).sort();
  if (JSON.stringify(packedFiles) !== JSON.stringify([...expectedFiles].sort())) {
    throw new Error(`Unexpected package contents: ${packedFiles.join(', ')}`);
  }

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

    const load =
      moduleType === 'module'
        ? "await import('rag-citation-check')"
        : "require('rag-citation-check')";
    const expression = `
      const library = ${load};
      const inline = library.checkInlineCitations({ answer: '[1]', sources: [{ id: '1' }] });
      const structured = library.checkCitationClaims({
        claims: [{ id: 'claim', text: 'Claim', citations: [{ sourceId: 'doc', quote: 'proof' }] }],
        sources: [{ id: 'doc', content: 'proof' }],
      });
      if (inline.kind !== 'completed' || inline.report.outcome !== 'pass') process.exit(1);
      if (structured.kind !== 'completed' || structured.report.outcome !== 'pass') process.exit(1);
    `;
    const arguments_ =
      moduleType === 'module'
        ? ['--input-type=module', '--eval', expression]
        : ['--eval', expression];

    run(node, arguments_, consumerDirectory);

    const internalImport =
      moduleType === 'module'
        ? "await import('rag-citation-check/dist/index.js').then(() => process.exit(1), () => {})"
        : "try { require('rag-citation-check/dist/index.cjs'); process.exit(1); } catch {}";
    run(
      node,
      moduleType === 'module'
        ? ['--input-type=module', '--eval', internalImport]
        : ['--eval', internalImport],
      consumerDirectory,
    );
  }
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
