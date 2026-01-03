import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: [
        'src/**/*.test.js',
        'src/main.js',
        'src/game.js',
      ]
    },
    // Increase timeout for LLM generation tests
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
