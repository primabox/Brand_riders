import fs from 'fs/promises';
import path from 'path';

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walkAndPatch(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walkAndPatch(p);
      continue;
    }
    if (!/\.mjs$|\.js$/.test(e.name)) continue;
    let content = await fs.readFile(p, 'utf8');
    if (content.includes("import { styleText } from \"node:util\"") || content.includes("import { styleText } from 'node:util'")) {
      const newContent = content.replace(/import\s*\{\s*styleText\s*\}\s*from\s*['"]node:util['"];?/g,
        "import * as util from 'util';\nconst styleText = util.styleText ?? util.inspect;");
      await fs.writeFile(p, newContent, 'utf8');
      console.log('Patched', p);
    }
  }
}

async function main() {
  const root = process.cwd();
  const candidates = [
    path.join(root, 'node_modules', 'rolldown'),
    path.join(root, 'node_modules', 'rolldown-vite'),
    path.join(root, 'node_modules')
  ];

  for (const dir of candidates) {
    if (!(await fileExists(dir))) continue;
    try {
      await walkAndPatch(dir);
    } catch (err) {
      // non-fatal, print and continue
      console.error('Error while patching', dir, err.message || err);
    }
  }
}

main().catch(err => {
  console.error(err);
  // don't fail install because of patch script
  process.exit(0);
});
