const { execFileSync } = require('child_process');
const { readdirSync, statSync } = require('fs');
const { join } = require('path');

const roots = ['src', 'scripts', 'tests', 'prisma'].map((root) => join(process.cwd(), root));

const collectJavaScriptFiles = (directory) => {
  const entries = readdirSync(directory);

  return entries.flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return collectJavaScriptFiles(path);
    }

    return path.endsWith('.js') ? [path] : [];
  });
};

const files = roots.flatMap(collectJavaScriptFiles);

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log(`Checked ${files.length} JavaScript files`);
