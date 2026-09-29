import { createContext, useContext, type ReactNode } from 'react';
import { translate, type SalesLocale, type SalesMessageKey } from './messages';

const SalesLanguageContext = createContext<SalesLocale>('en');

export function SalesLanguageProvider({
  locale,
  children,
}: {
  locale: SalesLocale;
  children: ReactNode;
}) {
  return <SalesLanguageContext.Provider value={locale}>{children}</SalesLanguageContext.Provider>;
}

export function useSalesLocale(): SalesLocale {
  return useContext(SalesLanguageContext);
}

export function useT(): (key: SalesMessageKey) => string {
  const locale = useSalesLocale();
  return (key) => translate(locale, key);
}
