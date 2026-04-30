import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Currency = "NGN" | "USD";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rate: number; // usd_to_ngn
  format: (priceNgn: number, priceUsd: number) => string;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const formatters = {
  NGN: new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("vg_currency") : null;
    return (stored === "USD" ? "USD" : "NGN") as Currency;
  });
  const [rate, setRate] = useState(1650);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "exchange_rate")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as { usd_to_ngn?: number; default_currency?: Currency };
          if (v.usd_to_ngn) setRate(v.usd_to_ngn);
          if (!localStorage.getItem("vg_currency") && v.default_currency) {
            setCurrencyState(v.default_currency);
          }
        }
      });
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem("vg_currency", c);
  };

  const format = (priceNgn: number, priceUsd: number) => {
    if (currency === "NGN") return formatters.NGN.format(priceNgn);
    return formatters.USD.format(priceUsd);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, format, symbol: currency === "NGN" ? "₦" : "$" }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
};
