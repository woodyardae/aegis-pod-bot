const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const srcDir = path.join(__dirname, '../src/dashboard/public');
const destDir = path.join(__dirname, '../dist/dashboard/public');

if (fs.existsSync(srcDir)) {
  copyDirSync(srcDir, destDir);
  console.log('[Build] Copied dashboard assets to dist/');
} else {
  console.error('[Build] Warning: src/dashboard/public directory not found!');
}
