import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Product, resolveImage } from "@/lib/products";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Heart, Minus, Plus, Star, ShoppingBag, Truck, Shield, CreditCard, ArrowLeft } from "lucide-react";
import { ProductCard } from "@/components/shop/ProductCard";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ProductDetail = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<{ id: string; rating: number; comment: string | null; created_at: string; user_id: string }[]>([]);
  const [qty, setQty] = useState(1);
  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const { add } = useCart();
  const { toggle, isWished } = useWishlist();
  const { format, currency } = useCurrency();
  const { user } = useAuth();

  useEffect(() => {
    if (!slug) return;
    setQty(1); setActiveImg(0);
    supabase.from("products").select("*").eq("slug", slug).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProduct(data as Product);
          supabase.from("products").select("*").eq("active", true).neq("id", data.id).limit(4)
            .then(({ data: r }) => r && setRelated(r as Product[]));
          supabase.from("reviews").select("id,rating,comment,created_at,user_id").eq("product_id", data.id).order("created_at", { ascending: false })
            .then(({ data: rv }) => rv && setReviews(rv));
        }
      });
  }, [slug]);

  if (!product) {
    return <Layout><div className="container py-32 text-center text-muted-foreground">Loading...</div></Layout>;
  }

  const images = product.images.length > 0 ? product.images : [""];
  const img = resolveImage(images[activeImg]);
  const wished = isWished(product.id);
  const compare = currency === "NGN" ? product.compare_price_ngn : product.compare_price_usd;
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const onAdd = () => add({
    id: product.id, name: product.name, slug: product.slug, image: img,
    price_ngn: product.price_ngn, price_usd: product.price_usd, stock: product.stock,
  }, qty);

  const submitReview = async () => {
    if (!user) { toast.error("Sign in to leave a review"); return; }
    const { error } = await supabase.from("reviews").upsert({
      product_id: product.id, user_id: user.id, rating: newRating, comment: newComment || null,
    }, { onConflict: "product_id,user_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Review posted");
    setNewComment("");
    const { data } = await supabase.from("reviews").select("id,rating,comment,created_at,user_id").eq("product_id", product.id).order("created_at", { ascending: false });
    if (data) setReviews(data);
  };

  return (
    <Layout>
      <div className="container py-8">
        <Link to="/shop" className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-muted-foreground hover:text-primary story-link">
          <ArrowLeft className="size-3" /> Back to shop
        </Link>
      </div>

      <section className="container grid lg:grid-cols-2 gap-12 pb-16">
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative aspect-[4/5] bg-card overflow-hidden cursor-zoom-in group"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setZoomPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
            }}
            onMouseLeave={() => setZoomPos(null)}
          >
            <img
              src={img}
              alt={product.name}
              className="size-full object-cover transition-transform duration-500"
              style={zoomPos ? { transform: "scale(2)", transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
            />
          </motion.div>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.map((im, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`aspect-square overflow-hidden ${activeImg === i ? "ring-1 ring-primary" : "opacity-60"}`}
                >
                  <img src={resolveImage(im)} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:py-8">
          <p className="text-[11px] tracking-[0.3em] uppercase text-primary mb-3">{product.brand}</p>
          <h1 className="font-display text-4xl md:text-6xl leading-tight mb-4">{product.name}</h1>

          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mb-6">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`size-4 ${i < Math.round(avgRating) ? "fill-primary text-primary" : "text-muted"}`} />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">({reviews.length} reviews)</span>
            </div>
          )}

          <div className="flex items-baseline gap-3 mb-6">
            <span className="font-display text-4xl text-gold">{format(product.price_ngn, product.price_usd)}</span>
            {compare && <span className="text-lg text-muted-foreground line-through">{currency === "NGN" ? `₦${compare.toLocaleString()}` : `$${compare}`}</span>}
          </div>

          <p className="text-muted-foreground leading-relaxed mb-8">{product.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
            <div className="border border-border p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Length</p>
              <p className="font-display text-xl">{product.length_inches} inches</p>
            </div>
            <div className="border border-border p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Texture</p>
              <p className="font-display text-xl">{product.hair_type}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center border border-border h-12">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="size-12 grid place-items-center hover:text-primary"><Minus className="size-3" /></button>
              <span className="w-10 text-center">{qty}</span>
              <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="size-12 grid place-items-center hover:text-primary"><Plus className="size-3" /></button>
            </div>
            <Button onClick={onAdd} variant="gold" size="lg" className="flex-1 h-12">
              <ShoppingBag className="size-4" /> Add to bag
            </Button>
            <Button
              onClick={() => toggle(product.id, product.name)}
              variant="luxe"
              size="icon"
              className="h-12 w-12"
              aria-label="Wishlist"
            >
              <Heart className={`size-4 ${wished ? "fill-primary text-primary" : ""}`} />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mb-8">{product.stock > 0 ? `${product.stock} in stock — ships within 48h` : "Out of stock"}</p>

          <div className="border border-primary/30 bg-primary/5 p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="size-4 text-primary" />
              <span className="font-display text-lg text-primary">Pay Small Small</span>
            </div>
            <p className="text-sm text-muted-foreground">Split this into 2, 3 or 4 payments at checkout. Order ships once fully paid.</p>
          </div>

          <div className="space-y-3 text-sm">
            {[
              { Icon: Truck, t: "Free shipping over ₦150,000 / $100" },
              { Icon: Shield, t: "30-day quality guarantee" },
              { Icon: Star, t: "Single-donor raw, cuticle aligned" },
            ].map(({ Icon, t }, i) => (
              <div key={i} className="flex items-center gap-3 text-muted-foreground">
                <Icon className="size-4 text-primary" /> {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="container py-16 border-t border-border">
        <h2 className="font-display text-4xl mb-8">Reviews</h2>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            {reviews.length === 0 && <p className="text-muted-foreground">No reviews yet — be the first.</p>}
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-border pb-6">
                <div className="flex items-center gap-2 mb-2">
                  {[...Array(5)].map((_, i) => <Star key={i} className={`size-3.5 ${i < r.rating ? "fill-primary text-primary" : "text-muted"}`} />)}
                  <span className="text-xs text-muted-foreground ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm">{r.comment || "Loved it."}</p>
              </div>
            ))}
          </div>

          <div className="border border-border p-6 bg-card/40 h-fit">
            <h3 className="font-display text-2xl mb-4">Leave a review</h3>
            {!user ? (
              <p className="text-sm text-muted-foreground">
                <Link to="/auth" className="text-primary story-link">Sign in</Link> to leave a review.
              </p>
            ) : (
              <>
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setNewRating(n)}>
                      <Star className={`size-6 ${n <= newRating ? "fill-primary text-primary" : "text-muted"}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your experience..."
                  rows={4}
                  className="w-full bg-input border border-border p-3 text-sm mb-4 focus:outline-none focus:border-primary"
                />
                <Button onClick={submitReview} variant="gold" className="w-full">Post review</Button>
              </>
            )}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container py-16 border-t border-border">
          <h2 className="font-display text-4xl mb-8">You may also love</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-12">
            {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}
    </Layout>
  );
};

export default ProductDetail;
