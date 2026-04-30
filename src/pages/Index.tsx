import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/shop/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import type { Product, Category } from "@/lib/products";
import { resolveImage } from "@/lib/products";
import heroImg from "@/assets/hero-model.jpg";
import { ArrowRight, Sparkles, Truck, Shield, CreditCard, Star } from "lucide-react";

const Index = () => {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 150]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0.3]);

  useEffect(() => {
    supabase.from("products").select("*").eq("featured", true).eq("active", true).limit(8)
      .then(({ data }) => data && setFeatured(data as Product[]));
    supabase.from("categories").select("*").order("sort_order")
      .then(({ data }) => data && setCategories(data as Category[]));
  }, []);

  return (
    <Layout>
      {/* HERO */}
      <section className="section-dark relative min-h-[92vh] overflow-hidden flex items-center bg-[hsl(0_0%_6%)]">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 z-0">
          <img src={heroImg} alt="Vivygold luxury hair" className="size-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
        </motion.div>

        <div className="container relative z-10 grid lg:grid-cols-2 gap-12 items-center py-20">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-3 mb-6"
            >
              <div className="h-px w-12 bg-gold" />
              <span className="text-[11px] tracking-[0.3em] uppercase text-primary">The Liquid Gold Edit</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1 }}
              className="font-display text-5xl sm:text-7xl lg:text-8xl leading-[0.95] mb-6"
            >
              Hair worn like<br />
              <span className="text-gold italic">heirloom.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="text-base sm:text-lg text-muted-foreground max-w-md mb-8 leading-relaxed"
            >
              Single-donor raw hair, HD lace, and silhouettes designed to be remembered.
              Pay in full or <span className="text-primary">Pay Small Small</span>.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-wrap gap-3"
            >
              <Button asChild variant="gold" size="xl">
                <Link to="/shop">Shop the collection <ArrowRight className="size-4" /></Link>
              </Button>
              <Button asChild variant="goldOutline" size="xl">
                <Link to="/about">Our story</Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="flex items-center gap-6 mt-12"
            >
              <div className="flex -space-x-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-xs tracking-wider text-muted-foreground"><span className="text-foreground font-medium">2,300+</span> exceptional women styled</p>
            </motion.div>
          </div>

          <div className="hidden lg:block" />
        </div>

        {/* gold particles */}
        <div className="absolute right-10 top-1/3 size-2 bg-primary rounded-full animate-float opacity-60" />
        <div className="absolute right-1/3 bottom-1/4 size-1 bg-primary rounded-full animate-float opacity-40" style={{ animationDelay: "1s" }} />
      </section>

      {/* USP STRIP */}
      <section className="border-y border-border bg-card/30">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          {[
            { Icon: Sparkles, t: "Single-donor raw", s: "Cuticle aligned" },
            { Icon: Truck, t: "Worldwide delivery", s: "Free over ₦150,000" },
            { Icon: CreditCard, t: "Pay Small Small", s: "Split into 2–4" },
            { Icon: Shield, t: "30-day guarantee", s: "Authenticated hair" },
          ].map(({ Icon, t, s }, i) => (
            <div key={i} className="bg-background p-6 flex items-center gap-3 hover-glow">
              <Icon className="size-6 text-primary flex-shrink-0" strokeWidth={1.2} />
              <div>
                <p className="text-sm font-medium">{t}</p>
                <p className="text-xs text-muted-foreground">{s}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container py-24">
        <div className="text-center mb-14">
          <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Shop by category</span>
          <h2 className="font-display text-5xl md:text-6xl mt-3">The collection</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.07 }}
            >
              <Link to={`/shop?cat=${cat.slug}`} className="group block relative aspect-[3/4] overflow-hidden bg-card border border-border">
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-10" />
                <div className="absolute inset-0 bg-radial-gold opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-10" />
                <img
                  src={resolveImage(cat.image_url)}
                  alt={cat.name}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-1000 ease-luxe group-hover:scale-110"
                />
                <div className="absolute inset-x-0 bottom-0 p-5 z-20">
                  <p className="font-display text-2xl text-on-dark group-hover:text-primary-glow transition-colors">{cat.name}</p>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-on-dark-muted mt-1 flex items-center gap-1">
                    Explore <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="container py-24">
        <div className="flex items-end justify-between mb-12">
          <div>
            <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Signature</span>
            <h2 className="font-display text-5xl md:text-6xl mt-3">Bestsellers</h2>
          </div>
          <Link to="/shop" className="text-xs tracking-[0.2em] uppercase text-primary story-link hidden sm:block">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-12">
          {featured.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </section>

      {/* EDITORIAL BANNER */}
      <section className="section-dark relative overflow-hidden my-24 bg-[hsl(0_0%_6%)]">
        <div className="absolute inset-0">
          <img src={heroImg} alt="" className="size-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20" />
        </div>
        <div className="container relative z-10 py-32 max-w-2xl">
          <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Pay Small Small</span>
          <h2 className="font-display text-5xl md:text-7xl mt-3 mb-6 leading-[0.95]">
            Wear it now.<br /><span className="text-gold italic">Pay in pieces.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-md">
            Split any order into 2, 3 or 4 payments. No interest, no hidden fees. Order ships once fully paid.
          </p>
          <Button asChild variant="gold" size="xl">
            <Link to="/shop">Start with a piece</Link>
          </Button>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="container py-24">
        <div className="text-center mb-14">
          <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Whispered by clients</span>
          <h2 className="font-display text-5xl md:text-6xl mt-3">She wore Vivygold</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: "Adaeze O.", text: "I've tried every brand in Lagos. Nothing reverses heads like a Vivygold install. The lace truly disappears." },
            { name: "Tomi A.", text: "Pay Small Small saved me. I got my dream 28-inch wig for my wedding without breaking my budget." },
            { name: "Chioma N.", text: "Three years in, the bundles still look freshly bought. This is hair you keep, not replace." },
          ].map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="border border-border p-8 bg-card/40 hover-glow"
            >
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, j) => <Star key={j} className="size-3.5 fill-primary text-primary" />)}
              </div>
              <p className="font-display text-xl leading-snug mb-6">"{t.text}"</p>
              <p className="text-xs tracking-[0.2em] uppercase text-primary">— {t.name}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </Layout>
  );
};

export default Index;
