import { createI18n } from "vue-i18n";
import zhTW from "./locales/zh-TW";
import enUS from "./locales/en-US";

const savedLocale = localStorage.getItem("locale") || "zh-TW";

export const i18n = createI18n({
  legacy: false,            // ✅ Vue3 Composition API 用法
  locale: savedLocale,          // 預設語系
  fallbackLocale: "en-US",
  messages: {
    "zh-TW": zhTW,
    "en-US": enUS,
  },
});
