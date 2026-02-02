import * as build from './dist/server/index.js';

export default {
  async fetch(request, env, context) {
    try {
      const url = new URL(request.url);
      
      // Serve static assets directly
      if (url.pathname.startsWith('/assets/') || 
          url.pathname.startsWith('/fonts/') || 
          url.pathname.startsWith('/image/')) {
        return env.ASSETS.fetch(request);
      }

      // Create app context
      const appLoadContext = {
        env,
        session: {
          isPending: false,
          commit: async () => '',
        },
        storefront: {
          query: async () => ({}),
        },
        waitUntil: context.waitUntil.bind(context),
      };

      // Handle SSR
      const response = await build.default.fetch(request, appLoadContext);
      
      return response;
    } catch (error) {
      console.error(error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};