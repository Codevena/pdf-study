import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/index.ts', 'src/**/*.test.ts'],
    },
    // Mock Electron modules
    alias: {
      electron: './src/test/mocks/electron.ts',
    },
  },
});
