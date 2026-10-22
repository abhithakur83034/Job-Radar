import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests connect to a remote MongoDB (Atlas); allow for slow connection setup
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
