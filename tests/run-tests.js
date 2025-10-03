import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testDir = __dirname;
const files = fs
  .readdirSync(testDir)
  .filter(file => file.endsWith('.test.js'))
  .map(file => join(testDir, file));

let failed = 0;

for (const file of files) {
  try {
    // eslint-disable-next-line no-await-in-loop
    await import(fileToUrl(file));
    console.log(`✓ ${file}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${file}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}

function fileToUrl(file) {
  return new URL(file, 'file://');
}
