"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations } from "@/lib/translations";

type Language = "en" | "es";
type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "es" ? "ltr" : "ltr";
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language;
    if (savedLanguage && (savedLanguage === "en" || savedLanguage === "es")) {
      setLanguage(savedLanguage);
    } else {
      // Detect user's preferred language
      const browserLanguage = navigator.language.toLowerCase();
      if (browserLanguage.startsWith("es")) {
        setLanguage("es");
      } else {
        setLanguage("en");
      }
    }
  }, []);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    isRTL: false, // Both English and Spanish are LTR
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}