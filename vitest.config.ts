import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: ['src/**/*.test.ts', 'src/main.tsx'],
      },
    },
  }),
)
