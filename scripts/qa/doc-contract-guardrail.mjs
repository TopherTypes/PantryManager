import fs from 'node:fs';
import path from 'node:path';

const TARGET_DIRS = ['assets/js/domain', 'assets/js/platform', 'assets/js/validation'];

function walkJavaScriptFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkJavaScriptFiles(fullPath);
    if (entry.isFile() && fullPath.endsWith('.js')) return [fullPath];
    return [];
  });
}

function hasImmediateJsDoc(lines, exportLineIndex) {
  let cursor = exportLineIndex - 1;
  while (cursor >= 0 && lines[cursor].trim() === '') cursor -= 1;
  if (cursor < 0 || !lines[cursor].trim().endsWith('*/')) return false;

  while (cursor >= 0 && !lines[cursor].includes('/**')) cursor -= 1;
  return cursor >= 0;
}

function validateFile(rootDir, filePath) {
  const violations = [];
  const source = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(rootDir, filePath);
  const lines = source.split(/\r?\n/);

  const staleMarkers = [...source.matchAll(/\b(TODO|FIXME)\b/g)];
  staleMarkers.forEach((match) => {
    const lineNumber = source.slice(0, match.index).split(/\r?\n/).length;
    violations.push(`${relativePath}:${lineNumber} stale marker found (${match[1]}).`);
  });

  const hasExports = lines.some((line) => /^export\s+/.test(line.trim()));
  if (hasExports) {
    const topOfModule = lines.slice(0, 80).join('\n');
    if (!/Usage:/.test(topOfModule)) {
      violations.push(`${relativePath}:1 missing module usage notes (include \"Usage:\" in top-level docs).`);
    }
  }

  lines.forEach((line, index) => {
    if (/^export\s+(async\s+)?function\s+/.test(line.trim()) && !hasImmediateJsDoc(lines, index)) {
      violations.push(`${relativePath}:${index + 1} exported function missing JSDoc block.`);
    }
  });

  return violations;
}

const rootDir = process.cwd();
const allViolations = TARGET_DIRS.flatMap((targetDir) => {
  const fullDir = path.join(rootDir, targetDir);
  return walkJavaScriptFiles(fullDir).flatMap((filePath) => validateFile(rootDir, filePath));
});

if (allViolations.length > 0) {
  console.error('Documentation guardrail violations detected:\n');
  allViolations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log('Documentation guardrail checks passed.');
