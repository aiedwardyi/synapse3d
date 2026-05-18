import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'mediapipe',
              test: /node_modules[\\/]@mediapipe[\\/]tasks-vision[\\/]/,
              priority: 30
            },
            {
              name: 'three',
              test: /node_modules[\\/]three[\\/]/,
              priority: 20,
              maxSize: 450 * 1024
            },
            {
              name: 'force-graph',
              test: /node_modules[\\/](3d-force-graph|three-forcegraph|three-render-objects)[\\/]/,
              priority: 10,
              maxSize: 450 * 1024
            }
          ]
        }
      }
    }
  }
})
