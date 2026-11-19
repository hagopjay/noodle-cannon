// Zero-dependency build: inline every module, in dependency order, into one self-contained HTML file.
// Same sources in, same bytes out.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const ORDER = ['engine', 'noodle', 'modes/base', 'modes/launch', 'modes/relay', 'modes/golf', 'render', 'audio', 'main'];
const strip = (src) => src.split('\n').filter(l => !/^\s*import\s.*from\s+['"].*['"];?\s*$/.test(l) && !/^\s*export\s*\{[^}]*\};?\s*$/.test(l))
  .map(l => l.replace(/^export\s+(?=(class|function|const|let)\b)/, '')).join('\n');
const js = ORDER.map(f => `// ---- src/${f}.js ----\n` + strip(readFileSync(`src/${f}.js`, 'utf8'))).join('\n');
const html = readFileSync('index.html', 'utf8').replace('<script type="module" src="src/main.js"></script>', () => `<script type="module">\n${js}\n</script>`);
mkdirSync('dist', { recursive: true }); writeFileSync('dist/noodle-cannon.html', html);
console.log('dist/noodle-cannon.html', html.length, 'bytes');
