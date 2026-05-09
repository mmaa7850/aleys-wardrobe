import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from "./router";
import {createPinia} from "pinia";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import {i18n} from "@/i18n";
import { initGA } from '@/lib/gtag';

initGA();
createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
