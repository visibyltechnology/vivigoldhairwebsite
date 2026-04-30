import { Link } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { Product, resolveImage } from "@/lib/products";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";

export const ProductCard = ({ product, index = 0 }: { product: Product; index?: number }) => {
  const { add } = useCart();
  const { toggle, isWished } = useWishlist();
  const { format, currency } = useCurrency();
  const img = resolveImage(product.images[0]);
  const wished = isWished(product.id);

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    add({
      id: product.id,
      name: product.name,
      slug: product.slug,
      image: img,
      price_ngn: product.price_ngn,
      price_usd: product.price_usd,
      stock: product.stock,
    });
  };

  const compare = currency === "NGN" ? product.compare_price_ngn : product.compare_price_usd;
  const price = currency === "NGN" ? product.price_ngn : product.price_usd;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className="group"
    >
      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-white border border-border shadow-sm group-hover:shadow-elegant transition-shadow duration-500">
          <div className="absolute inset-0 bg-radial-gold opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-10 pointer-events-none" />
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-1000 ease-luxe group-hover:scale-110"
          />
          {compare && (
            <span className="absolute top-3 left-3 z-20 bg-gold text-primary-foreground text-[10px] tracking-[0.2em] uppercase px-2.5 py-1">
              Sale
            </span>
          )}
          {product.featured && !compare && (
            <span className="absolute top-3 left-3 z-20 border border-primary/60 text-primary text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 bg-white/85 backdrop-blur-sm">
              Signature
            </span>
          )}
          <button
            onClick={(e) => { e.preventDefault(); toggle(product.id, product.name); }}
            aria-label="Wishlist"
            className={`absolute top-3 right-3 z-20 size-9 grid place-items-center rounded-full backdrop-blur-md transition-all ${
              wished ? "bg-gold text-primary-foreground" : "bg-white/85 text-foreground hover:bg-gold hover:text-primary-foreground"
            }`}
          >
            <Heart className={`size-4 ${wished ? "fill-current" : ""}`} />
          </button>
          <div className="absolute inset-x-3 bottom-3 z-20 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-luxe">
            <Button onClick={onAdd} variant="gold" size="sm" className="w-full">
              <ShoppingBag className="size-3" /> Add to bag
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {product.hair_type} · {product.length_inches}"
          </p>
          <h3 className="font-display text-xl leading-tight group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-primary font-medium">{format(product.price_ngn, product.price_usd)}</span>
            {compare && (
              <span className="text-xs text-muted-foreground line-through">
                {currency === "NGN" ? `₦${compare.toLocaleString()}` : `$${compare}`}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};
