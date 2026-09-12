const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const iconSvg = path.join(publicDir, 'icon.svg');
const svgContent = fs.readFileSync(iconSvg, 'utf8');

const sizes = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 }
];

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

for (const { name, size } of sizes) {
  const htmlPath = path.join(publicDir, `_temp_${size}.html`);
  const outPath = path.join(publicDir, name);
  
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
  svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
${svgContent}
</body>
</html>`;

  fs.writeFileSync(htmlPath, html, 'utf8');
  
  const cmd = `"${edgePath}" --headless --disable-gpu --hide-scrollbars --window-size=${size},${size} --default-background-color=00000000 --screenshot="${outPath}" "file:///${htmlPath.replace(/\\/g, '/')}"`;
  
  try {
    execSync(cmd, { stdio: 'ignore' });
    console.log(`Generated ${name} (${size}x${size})`);
  } catch (err) {
    console.error(`Error generating ${name}:`, err);
  } finally {
    try { fs.unlinkSync(htmlPath); } catch (_) {}
  }
}
