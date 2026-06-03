import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from "./router";
import {createPinia} from "pinia";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import {i18n} from "@/i18n";
import { initGA } from '@/lib/gtag';

// Vite chunk 載入失敗（redeploy 後舊 hash 消失）→ 自動重新整理頁面
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

initGA();
createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
