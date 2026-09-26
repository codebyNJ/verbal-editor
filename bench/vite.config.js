import { defineConfig } from 'vite';

// React is one shared chunk, left out of every size: Verbal's numbers leave it out too.
const react = /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/;

export default defineConfig({
  root: import.meta.dirname,
  logLevel: 'warn',
  resolve: { dedupe: ['react', 'react-dom'] },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: true,
    target: 'es2022',
    chunkSizeWarningLimit: Infinity,
    rollupOptions: { output: { manualChunks: (id) => (react.test(id) ? 'react' : undefined) } },
  },
});
