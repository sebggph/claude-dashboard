import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const STATIC_DEMO = process.env.VITE_STATIC_DEMO === '1';

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        // Runes mode for our code (Svelte 5).
        runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
      },
      // Normal build: Node server. Online demo (VITE_STATIC_DEMO=1): static files
      // for GitHub Pages, served under BASE_PATH (e.g. /claude-dashboard).
      adapter: STATIC_DEMO ? adapterStatic({ fallback: 'index.html', strict: false }) : adapterNode(),
      paths: { base: STATIC_DEMO ? process.env.BASE_PATH || '' : '' },
    }),
  ],
  server: { port: 5173 },
});
