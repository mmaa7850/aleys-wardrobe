import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import {fileURLToPath, URL} from "node:url";

// 讓 dev server 支援 POST 請求（藍新 ReturnURL 會用 POST 跳轉回網站）
const spaPostFallback = {
  name: 'spa-post-fallback',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.method === 'POST') req.method = 'GET'
      next()
    })
  },
}

export default defineConfig({
  plugins: [vue(), spaPostFallback],
  resolve:{
    alias:{
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
