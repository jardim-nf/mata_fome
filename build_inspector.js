const { execSync } = require('child_process');
const fs = require('fs');

try {
  const result = execSync('npx vite build', { encoding: 'utf-8', stdio: 'pipe' });
  fs.writeFileSync('build_dump.txt', 'SUCCESS\n' + result);
} catch (error) {
  fs.writeFileSync('build_dump.txt', 'ERROR\n' + error.message + '\nSTDOUT:\n' + error.stdout + '\nSTDERR:\n' + error.stderr);
}
