import {defineConfig} from 'rolldown';

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      dir: 'dist',
      format: 'es',
      entryFileNames: 'index.js',
    },
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: 'index.cjs',
      chunkFileNames: '[name]-[hash].cjs',
    },
  ],
});
