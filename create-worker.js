import { readFileSync, writeFileSync, existsSync } from 'fs';

console.log('Creating bundled worker file...');

const serverPath = 'dist/server/index.js';
if (!existsSync(serverPath)) {
  console.error(`Expected server bundle not found at ${serverPath}. Did the build produce a server bundle?`);
  console.error('Run `npm run build` and ensure your Vite configuration (and plugins like @react-router/dev) create a server build at dist/server/index.js.');
  process.exit(1);
}

let serverCode = readFileSync(serverPath, 'utf-8');

// Transform common forms of default export into a local variable to avoid duplicate `export default` in the final worker bundle.
// Examples handled:
//  - export { server as default }
//  - export default server
//  - export default <identifier>
serverCode = serverCode
  .replace(/export\s*\{\s*server\s+as\s+default\s*\}\s*;?/g, 'const __server = server;')
  .replace(/export\s+default\s+server\s*;?/g, 'const __server = server;')
  .replace(/export\s+default\s+(\w+)\s*;?/g, (m, p1) => `const __server = ${p1};`);

const workerCode = `
// Bundled server code (transformed)
${serverCode}

// Resolve server handler (fallbacks for different bundle shapes)
const _server_export = typeof __server !== 'undefined' ? __server : (typeof server !== 'undefined' ? server : (typeof defaultExport !== 'undefined' ? defaultExport : null));
if (!_server_export || typeof _server_export.fetch !== 'function') {
  console.error('No server fetch handler found. Expected a default export with a fetch(request, env, context) function.');
  throw new Error('No server fetch handler found.');
}

// Worker export - delegate to server's fetch
export default {
  async fetch(request, env, context) {
    try {
      return await _server_export.fetch(request, env, context);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error: ' + (error && error.message ? error.message : String(error)), {
        status: 500,
      });
    }
  },
};
`;

writeFileSync('dist/client/_worker.js', workerCode);
console.log('✓ Successfully created dist/client/_worker.js with bundled server code');