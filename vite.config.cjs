const { defineConfig } = require('vite')
const react = require('@vitejs/plugin-react')
const tailwindcss = require('@tailwindcss/vite').default

module.exports = defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
