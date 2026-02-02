import {readFileSync, writeFileSync, existsSync} from 'fs';

console.log('Creating bundled worker file...');

const serverPath = 'dist/server/index.js';
if (!existsSync(serverPath)) {
  console.error(
    `Expected server bundle not found at ${serverPath}. Did the build produce a server bundle?`,
  );
  console.error(
    'Run `npm run build` and ensure your Vite configuration (and plugins like @react-router/dev) create a server build at dist/server/index.js.',
  );
  process.exit(1);
}

let serverCode = readFileSync(serverPath, 'utf-8');

// Transform common forms of default export into a local variable to avoid duplicate `export default` in the final worker bundle.
// Examples handled:
//  - export { server as default }
//  - export default server
//  - export default <identifier>
serverCode = serverCode
  .replace(
    /export\s*\{\s*server\s+as\s+default\s*\}\s*;?/g,
    'const __server = server;',
  )
  .replace(/export\s+default\s+server\s*;?/g, 'const __server = server;')
  .replace(
    /export\s+default\s+(\w+)\s*;?/g,
    (m, p1) => `const __server = ${p1};`,
  );

const workerCode = `
// Bundled server code (transformed)
${serverCode}

// Resolve server handler (fallbacks for different bundle shapes)
const _server_export = typeof __server !== 'undefined' ? __server : (typeof server !== 'undefined' ? server : (typeof defaultExport !== 'undefined' ? defaultExport : null));
if (!_server_export || typeof _server_export.fetch !== 'function') {
  console.error('No server fetch handler found. Expected a default export with a fetch(request, env, context) function.');
  throw new Error('No server fetch handler found.');
}

// Worker export - serve static assets directly when possible, then delegate to server's fetch
export default {
  async fetch(request, env, context) {
    try {
      const url = new URL(request.url);      console.error('Worker fetch for', url.pathname, 'method', request.method);
      // Serve static assets directly from the Pages assets binding when available.
      if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.ico' || url.pathname === '/reset.css') {
        // Try common names for the Pages assets binding
        const assetsBindings = [env.ASSETS, env.__STATIC_CONTENT, env._STATIC_CONTENT];
        let foundAssets = false;
        for (const assets of assetsBindings) {
          const bindingName = assets === env.ASSETS ? 'env.ASSETS' : assets === env.__STATIC_CONTENT ? 'env.__STATIC_CONTENT' : assets === env._STATIC_CONTENT ? 'env._STATIC_CONTENT' : 'unknown';
          if (assets && typeof assets.fetch === 'function') {
            foundAssets = true;
            try {
              const assetRes = await assets.fetch(request);
              console.error('assets.fetch via ' + bindingName + ' returned status=' + (assetRes && assetRes.status) + ' for ' + url.pathname);
              if (assetRes && assetRes.status === 200) {
                // Log content type for debugging
                try { console.error('Asset content-type:', assetRes.headers.get('content-type')); } catch (e) {}
                return assetRes;
              }
            } catch (e) {
              console.error('Static asset fetch failed via ' + bindingName + ':', e);
              // ignore and fallback to server
            }
          } else {
            console.error('Assets binding ' + bindingName + ' not available or missing fetch()');
          }
        }
        if (!foundAssets) {
          console.error('No Pages assets binding found (env.ASSETS / env.__STATIC_CONTENT).');
          // If the request is clearly for an asset, return 404 instead of delegating to server to avoid request hanging/cancelled.
          console.error('Returning 404 for asset path', url.pathname);
          return new Response('Not Found', {status: 404});
        }
        // If assets binding existed but asset was not found, return 404 for asset requests to avoid long hangs.
        if (url.pathname.startsWith('/assets/')) {
          console.error('Asset not found in assets binding, returning 404 for', url.pathname);
          return new Response('Not Found', {status: 404});
        }
        // Otherwise, allow server to attempt to serve
      }

      // Delegate to server handler and log status for debugging
      const serverRes = await _server_export.fetch(request, env, context);
      console.error('server.fetch returned', serverRes && serverRes.status, 'for', url.pathname);
      return serverRes;
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
console.log(
  '✓ Successfully created dist/client/_worker.js with bundled server code',
);
