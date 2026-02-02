import { readFileSync, writeFileSync, existsSync } from 'fs';

console.log('Creating bundled worker file...');

const serverPath = 'dist/server/index.js';
if (!existsSync(serverPath)) {
  console.error(`Expected server bundle not found at ${serverPath}. Did the build produce a server bundle?`);
  console.error('Run `npm run build` and ensure your Vite configuration (and plugins like @react-router/dev) create a server build at dist/server/index.js.');
  process.exit(1);
}

const serverCode = readFileSync(serverPath, 'utf-8');

const workerCode = `
// Bundled server code
${serverCode}

// Worker export
export default {
  async fetch(request, env, context) {
    try {
      // Call the server's fetch handler
      return await handleRequest(request, env, context);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error: ' + error.message, { 
        status: 500 
      });
    }
  },
};
`;

writeFileSync('dist/client/_worker.js', workerCode);
console.log('✓ Successfully created dist/client/_worker.js with bundled server code');