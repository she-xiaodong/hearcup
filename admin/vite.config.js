import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 生产由 Go 后端挂载在 /admin/ 前缀下，资源路径需带前缀
  base: '/admin/',
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080' }
  }
})
