import { createContext, useContext, useMemo } from "react";
import { getLanguage, resolveLanguage, setLanguage, t } from "./i18n";

// Provider mỏng quanh bảng i18n mức module: đặt ngôn ngữ theo settings.language
// rồi re-render cả cây (App re-render khi settings đổi). Component có thể dùng
// useI18n() lấy { t, lang }, hoặc import { t } thẳng từ lib/i18n (tests render
// component không cần provider — t mặc định "vi").
const I18nContext = createContext({ t, lang: getLanguage() });

export function I18nProvider({ language = "auto", children }) {
  const lang = resolveLanguage(language);
  // Đặt ngay trong render để mọi t() của cây con (kể cả module-level) dùng đúng ngôn ngữ.
  setLanguage(lang);
  const value = useMemo(() => ({ t, lang }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
