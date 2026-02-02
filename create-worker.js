import { readFileSync, writeFileSync } from 'fs';

console.log('Creating bundled worker file...');

const serverCode = readFileSync('dist/server/index.js', 'utf-8');

const workerCode = `
// Bundled server code
${serverCode}
const defaultExport = exports?.default ?? globalThis?.default;
// Worker export
export default {
  async fetch(request, env, context) {
    try {
      // Call the server's fetch handler
      return await defaultExport.fetch(request, env, context);
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