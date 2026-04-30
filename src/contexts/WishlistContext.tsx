import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

interface WishlistContextValue {
  ids: Set<string>;
  toggle: (productId: string, productName?: string) => Promise<void>;
  isWished: (id: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);
const LOCAL_KEY = "vg_wishlist_v1";

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("wishlist")
      .select("product_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          const remote = new Set(data.map((d) => d.product_id));
          // merge with local
          setIds((local) => {
            const merged = new Set([...local, ...remote]);
            // push local-only to server
            local.forEach((pid) => {
              if (!remote.has(pid)) {
                supabase.from("wishlist").insert({ user_id: user.id, product_id: pid }).then(() => {});
              }
            });
            return merged;
          });
        }
      });
  }, [user]);

  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...ids]));
  }, [ids]);

  const toggle = useCallback(
    async (productId: string, productName?: string) => {
      const next = new Set(ids);
      if (next.has(productId)) {
        next.delete(productId);
        if (user) await supabase.from("wishlist").delete().eq("user_id", user.id).eq("product_id", productId);
        toast("Removed from wishlist");
      } else {
        next.add(productId);
        if (user) await supabase.from("wishlist").insert({ user_id: user.id, product_id: productId });
        toast.success("Saved to wishlist", { description: productName });
      }
      setIds(next);
    },
    [ids, user]
  );

  return (
    <WishlistContext.Provider value={{ ids, toggle, isWished: (id) => ids.has(id) }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be within WishlistProvider");
  return ctx;
};
