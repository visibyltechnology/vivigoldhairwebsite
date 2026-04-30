import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, X, ShoppingBag } from "lucide-react";

const Cart = () => {
  const { items, setQty, remove, subtotalNgn, subtotalUsd } = useCart();
  const { format, currency } = useCurrency();
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="container py-16 max-w-5xl">
        <h1 className="font-display text-5xl md:text-6xl mb-12">Your bag</h1>

        {items.length === 0 ? (
          <div className="text-center py-20 border border-border">
            <ShoppingBag className="size-12 text-muted-foreground mx-auto mb-4" strokeWidth={1} />
            <p className="font-display text-3xl mb-2">It's empty here</p>
            <p className="text-muted-foreground mb-6">Curate something exceptional.</p>
            <Button asChild variant="gold"><Link to="/shop">Shop the collection</Link></Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_400px] gap-12">
            <div className="space-y-6 divide-y divide-border">
              {items.map((it) => (
                <div key={it.id} className="flex gap-4 pt-6 first:pt-0">
                  <Link to={`/product/${it.slug}`} className="size-32 bg-card overflow-hidden flex-shrink-0">
                    <img src={it.image} alt={it.name} className="size-full object-cover" />
                  </Link>
                  <div className="flex-1">
                    <Link to={`/product/${it.slug}`} className="font-display text-2xl hover:text-primary">{it.name}</Link>
                    <p className="text-primary mt-1">{currency === "NGN" ? `₦${it.price_ngn.toLocaleString()}` : `$${it.price_usd}`}</p>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center border border-border">
                        <button onClick={() => setQty(it.id, it.quantity - 1)} className="size-9 grid place-items-center hover:text-primary"><Minus className="size-3" /></button>
                        <span className="w-10 text-center text-sm">{it.quantity}</span>
                        <button onClick={() => setQty(it.id, it.quantity + 1)} className="size-9 grid place-items-center hover:text-primary"><Plus className="size-3" /></button>
                      </div>
                      <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-sm">
                        <X className="size-4" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="border border-border p-6 h-fit bg-card/40 sticky top-28">
              <h3 className="font-display text-2xl mb-6">Order summary</h3>
              <div className="space-y-3 text-sm pb-4 border-b border-border">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{format(subtotalNgn, subtotalUsd)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="text-muted-foreground">At checkout</span></div>
              </div>
              <div className="flex justify-between items-baseline pt-4 mb-6">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span>
                <span className="font-display text-3xl text-gold">{format(subtotalNgn, subtotalUsd)}</span>
              </div>
              <Button variant="gold" size="lg" className="w-full" onClick={() => navigate("/checkout")}>Checkout</Button>
              <Button asChild variant="luxe" className="w-full mt-3"><Link to="/shop">Continue shopping</Link></Button>
            </aside>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Cart;
