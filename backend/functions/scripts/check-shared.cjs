const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '../../../shared/src/index.ts');
const bundled = path.resolve(__dirname, '../src/shared/club-slug.ts');
// The Firebase build runs both from the monorepo and from its isolated bundle.
if (fs.existsSync(source) && fs.readFileSync(source, 'utf8') !== fs.readFileSync(bundled, 'utf8')) {
  throw new Error('Shared slug schema is out of sync; copy shared/src/index.ts to functions/src/shared/club-slug.ts');
}
