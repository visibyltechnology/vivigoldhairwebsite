import { Link, NavLink } from "react-router-dom";
  import { Heart, Search, ShoppingBag, User, Menu, X, Sun, Moon } from "lucide-react";
  import { useState, useEffect } from "react";
  import { useCart } from "@/contexts/CartContext";
  import { useWishlist } from "@/contexts/WishlistContext";
  import { useAuth } from "@/contexts/AuthContext";
  import { useCurrency } from "@/contexts/CurrencyContext";
  import { useTheme } from "@/contexts/ThemeContext";
  import { Button } from "@/components/ui/button";
  import { motion, AnimatePresence } from "framer-motion";
  import vivygoldLogo from "@/assets/vivygold-logo.jpg";

  const links = [
    { to: "/", label: "Home" },
    { to: "/shop", label: "Shop" },
    { to: "/shop?cat=wigs", label: "Wigs" },
    { to: "/shop?cat=bundles", label: "Bundles" },
    { to: "/shop?cat=closures", label: "Closures & Frontals" },
    { to: "/about", label: "About" },
  ];

  export const Header = () => {
    const { count, open } = useCart();
    const { ids } = useWishlist();
    const { user, isAdmin } = useAuth();
    const { currency, setCurrency } = useCurrency();
    const { theme, toggleTheme } = useTheme();
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
      const onScroll = () => setScrolled(window.scrollY > 20);
      onScroll();
      window.addEventListener("scroll", onScroll);
      return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
      <>
        <div className="bg-gold text-primary-foreground text-[11px] tracking-[0.2em] uppercase py-2 text-center overflow-hidden">
          <div className="animate-marquee whitespace-nowrap inline-block">
            <span className="mx-8">✦ Free shipping on orders over ₦150,000</span>
            <span className="mx-8">✦ Pay Small Small available</span>
            <span className="mx-8">✦ Authentic raw hair guaranteed</span>
            <span className="mx-8">✦ Free shipping on orders over ₦150,000</span>
            <span className="mx-8">✦ Pay Small Small available</span>
            <span className="mx-8">✦ Authentic raw hair guaranteed</span>
          </div>
        </div>

        <header
          className={`sticky top-0 z-40 transition-all duration-500 ease-luxe ${
            scrolled ? "bg-background/85 backdrop-blur-xl border-b border-border" : "bg-background/40 backdrop-blur-sm"
          }`}
        >
          <div className="container flex items-center justify-between h-20">
            <button
              className="lg:hidden text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>

            <Link to="/" className="flex items-center group" aria-label="Vivygold — Exceptional Store">
              <img
                src={vivygoldLogo}
                alt="Vivygold Exceptional Store"
                className="h-12 sm:h-14 w-auto object-contain transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </Link>

            <nav className="hidden lg:flex items-center gap-8">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className={({ isActive }) =>
                    `text-xs uppercase tracking-[0.2em] story-link transition-colors ${
                      isActive ? "text-primary" : "text-foreground/80 hover:text-primary"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-1 sm:gap-2">
              <div className="hidden md:flex items-center text-[11px] tracking-widest border border-border rounded-sm overflow-hidden">
                <button
                  onClick={() => setCurrency("NGN")}
                  className={`px-2.5 py-1.5 transition-colors ${currency === "NGN" ? "bg-gold text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
                >
                  ₦ NGN
                </button>
                <button
                  onClick={() => setCurrency("USD")}
                  className={`px-2.5 py-1.5 transition-colors ${currency === "USD" ? "bg-gold text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
                >
                  $ USD
                </button>
              </div>

              {/* Dark / Light mode toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {theme === "dark" ? (
                    <motion.span
                      key="sun"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Sun className="size-4" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="moon"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Moon className="size-4" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>

              <Button asChild variant="ghost" size="icon" aria-label="Search">
                <Link to="/shop"><Search className="size-4" /></Link>
              </Button>
              <Button asChild variant="ghost" size="icon" aria-label="Wishlist" className="relative">
                <Link to="/wishlist">
                  <Heart className="size-4" />
                  {ids.size > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-gold text-primary-foreground text-[10px] size-4 grid place-items-center rounded-full font-semibold">
                      {ids.size}
                    </span>
                  )}
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" aria-label="Account">
                <Link to={user ? (isAdmin ? "/admin" : "/account") : "/auth"}>
                  <User className="size-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={open} aria-label="Cart" className="relative">
                <ShoppingBag className="size-4" />
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 bg-gold text-primary-foreground text-[10px] size-4 grid place-items-center rounded-full font-semibold"
                  >
                    {count}
                  </motion.span>
                )}
              </Button>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl lg:hidden"
            >
              <div className="container flex items-center justify-between h-20">
                <img src={vivygoldLogo} alt="Vivygold" className="h-12 w-auto object-contain" />
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                    {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  </Button>
                  <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                    <X className="size-5" />
                  </button>
                </div>
              </div>
              <nav className="container flex flex-col gap-1 mt-8">
                {links.map((l, i) => (
                  <motion.div
                    key={l.to}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to={l.to}
                      onClick={() => setMobileOpen(false)}
                      className="block py-4 border-b border-border font-display text-3xl hover:text-primary transition-colors"
                    >
                      {l.label}
                    </Link>
                  </motion.div>
                ))}
                <div className="flex gap-2 mt-8">
                  <Button
                    variant={currency === "NGN" ? "gold" : "luxe"}
                    onClick={() => setCurrency("NGN")}
                    className="flex-1"
                  >
                    ₦ Naira
                  </Button>
                  <Button
                    variant={currency === "USD" ? "gold" : "luxe"}
                    onClick={() => setCurrency("USD")}
                    className="flex-1"
                  >
                    $ Dollar
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  };
  