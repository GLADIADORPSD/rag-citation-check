import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const excludedDirectories = new Set(['.git', 'coverage', 'dist', 'node_modules']);
const textExtensions = new Set(['.cjs', '.cts', '.js', '.json', '.md', '.mjs', '.ts', '.yml']);

const collectFiles = (directory) => {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) {
        files.push(...collectFiles(join(directory, entry.name)));
      }
    } else if (textExtensions.has(extname(entry.name))) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
};

const fail = (message) => {
  throw new Error(message);
};

const files = collectFiles(root);
const secretPatterns = [
  /-----BEGIN (?:EC |OPENSSH |PGP |RSA )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bnpm_[A-Za-z0-9]{20,}\b/u,
  /\bsk-[A-Za-z0-9]{20,}\b/u,
];

for (const file of files) {
  const path = relative(root, file);
  const content = readFileSync(file, 'utf8');
  if (/[\t ]+$/mu.test(content)) {
    fail(`Trailing whitespace found in ${path}.`);
  }
  if (secretPatterns.some((pattern) => pattern.test(content))) {
    fail(`Possible secret material found in ${path}.`);
  }
}

const runtimeFiles = files.filter((file) => {
  const path = relative(root, file);
  return (
    path.startsWith('src/') &&
    path.endsWith('.ts') &&
    !path.endsWith('.test.ts') &&
    !path.includes('/__fixtures__/')
  );
});
const forbiddenRuntimePatterns = [
  /from ['"]node:(?:child_process|dgram|fs|http|https|net|os|process|tls|worker_threads)['"]/u,
  /\b(?:Bun|Deno|process)\./u,
  /\b(?:fetch|setInterval|setTimeout)\s*\(/u,
  /\b(?:Date\.now|Math\.random|performance\.now)\s*\(/u,
  /\bnew\s+(?:Date|RegExp)\s*\(/u,
];

for (const file of runtimeFiles) {
  const path = relative(root, file);
  const content = readFileSync(file, 'utf8');
  if (forbiddenRuntimePatterns.some((pattern) => pattern.test(content))) {
    fail(`Forbidden runtime capability or dynamic regex found in ${path}.`);
  }
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
  if (Object.keys(packageJson[field] ?? {}).length > 0) {
    fail(`package.json ${field} must remain empty for the 0.1.0 runtime.`);
  }
}
