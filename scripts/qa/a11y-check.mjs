import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

const checks = [
  {
    name: 'main landmark',
    pass: /<main\b/i.test(html),
    error: 'index.html should include a <main> landmark for baseline accessibility.',
  },
  {
    name: 'form labels',
    pass: /<label\b/i.test(html),
    error: 'index.html should include form labels (explicit or wrapped) for form controls.',
  },
  {
    name: 'document language',
    pass: /<html[^>]*\blang=/i.test(html),
    error: 'index.html should define <html lang="..."> for assistive technology compatibility.',
  },
];

const failures = checks.filter((check) => !check.pass);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`A11y baseline failed (${failure.name}): ${failure.error}`);
  }
  process.exit(1);
}

console.log('Accessibility baseline checks passed.');
