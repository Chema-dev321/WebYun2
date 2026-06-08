const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const regex = /\[var\(--([a-zA-Z0-9-]+)\)\]/g;
      const newContent = content.replace(regex, '(--$1)');
      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
}

processDir('/Users/desarolloweb/WebYun/src');
