import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, X, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

export const CartDrawer = () => {
  const { items, isOpen, close, setQty, remove, subtotalNgn, subtotalUsd } = useCart();
  const { format, currency, symbol } = useCurrency();

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-background border-l border-border p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border">
          <SheetTitle className="font-display text-2xl tracking-wide flex items-center justify-between">
            <span>Your Bag</span>
            <span className="text-xs tracking-[0.2em] text-muted-foreground uppercase">{items.length} item{items.length !== 1 ? "s" : ""}</span>
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <ShoppingBag className="size-12 text-muted-foreground mb-4" strokeWidth={1} />
            <p className="font-display text-2xl mb-2">Your bag is empty</p>
            <p className="text-sm text-muted-foreground mb-6">Curate something exceptional.</p>
            <Button asChild variant="gold" onClick={close}>
              <Link to="/shop">Discover the collection</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-border">
              {items.map((it) => (
                <div key={it.id} className="flex gap-4 py-4">
                  <Link to={`/product/${it.slug}`} onClick={close} className="size-20 bg-card overflow-hidden flex-shrink-0">
                    <img src={it.image} alt={it.name} className="size-full object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${it.slug}`} onClick={close} className="font-display text-lg leading-tight hover:text-primary block">
                      {it.name}
                    </Link>
                    <p className="text-primary text-sm mt-1">
                      {currency === "NGN" ? `${symbol}${it.price_ngn.toLocaleString()}` : `${symbol}${it.price_usd.toLocaleString()}`}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-border">
                        <button onClick={() => setQty(it.id, it.quantity - 1)} className="size-7 grid place-items-center hover:text-primary"><Minus className="size-3" /></button>
                        <span className="w-8 text-center text-sm">{it.quantity}</span>
                        <button onClick={() => setQty(it.id, it.quantity + 1)} className="size-7 grid place-items-center hover:text-primary"><Plus className="size-3" /></button>
                      </div>
                      <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground uppercase tracking-wider text-xs">Subtotal</span>
                <span className="font-display text-2xl text-gold">{format(subtotalNgn, subtotalUsd)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Taxes & shipping calculated at checkout.</p>
              <Button asChild variant="gold" size="lg" className="w-full" onClick={close}>
                <Link to="/checkout">Checkout</Link>
              </Button>
              <Button asChild variant="luxe" className="w-full" onClick={close}>
                <Link to="/cart">View full bag</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
