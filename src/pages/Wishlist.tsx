import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { ProductCard } from "@/components/shop/ProductCard";
import { useWishlist } from "@/contexts/WishlistContext";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/lib/products";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Wishlist = () => {
  const { ids } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const arr = [...ids];
    if (arr.length === 0) { setProducts([]); return; }
    supabase.from("products").select("*").in("id", arr).then(({ data }) => data && setProducts(data as Product[]));
  }, [ids]);

  return (
    <Layout>
      <div className="container py-16">
        <div className="text-center mb-12">
          <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Saved with intention</span>
          <h1 className="font-display text-5xl md:text-7xl mt-3">Your wishlist</h1>
        </div>
        {products.length === 0 ? (
          <div className="text-center py-20 border border-border max-w-md mx-auto">
            <Heart className="size-12 text-muted-foreground mx-auto mb-4" strokeWidth={1} />
            <p className="font-display text-2xl mb-4">Nothing saved yet</p>
            <Button asChild variant="gold"><Link to="/shop">Discover pieces</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-12">
            {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Wishlist;
