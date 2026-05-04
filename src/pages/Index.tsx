import { useEffect, useState, useCallback } from "react";
  import { Link } from "react-router-dom";
  import { motion, AnimatePresence } from "framer-motion";
  import { Layout } from "@/components/layout/Layout";
  import { Button } from "@/components/ui/button";
  import { ProductCard } from "@/components/shop/ProductCard";
  import { supabase } from "@/integrations/supabase/client";
  import type { Product, Category } from "@/lib/products";
  import { resolveImage } from "@/lib/products";
  import heroImg from "@/assets/hero-model.jpg";
  import { ArrowRight, Sparkles, Truck, Shield, CreditCard, Star, ChevronLeft, ChevronRight } from "lucide-react";

  const SLIDES = [
    {
      headline: <>Hair worn like<br /><span className="text-gold italic">heirloom.</span></>,
      sub: "Single-donor raw hair, HD lace, and silhouettes designed to be remembered.",
      cta: { label: "Shop the collection", to: "/shop" },
      tag: "The Liquid Gold Edit",
      pos: "object-top",
    },
    {
      headline: <>Crowns for<br /><span className="text-gold italic">exceptional women.</span></>,
      sub: "Cuticle-aligned bundles sourced from a single donor. The difference is visible from across the room.",
      cta: { label: "Explore bundles", to: "/shop?cat=bundles" },
      tag: "Raw & Authentic",
      pos: "object-center",
    },
    {
      headline: <>Wear it now.<br /><span className="text-gold italic">Pay in pieces.</span></>,
      sub: "Split any order into 2, 3 or 4 payments. No interest, no hidden fees. Order ships once fully paid.",
      cta: { label: "Start with a piece", to: "/shop" },
      tag: "Pay Small Small",
      pos: "object-bottom",
    },
  ];

  const Index = () => {
    const [featured, setFeatured] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [slide, setSlide] = useState(0);
    const [dir, setDir] = useState(1);
    const [paused, setPaused] = useState(false);

    const goTo = useCallback((idx: number, direction: number) => {
      setDir(direction);
      setSlide(idx);
    }, []);

    const prev = useCallback(() => {
      goTo((slide - 1 + SLIDES.length) % SLIDES.length, -1);
      setPaused(true);
    }, [slide, goTo]);

    const next = useCallback(() => {
      goTo((slide + 1) % SLIDES.length, 1);
      setPaused(true);
    }, [slide, goTo]);

    useEffect(() => {
      if (paused) {
        const t = setTimeout(() => setPaused(false), 8000);
        return () => clearTimeout(t);
      }
      const t = setInterval(() => {
        setDir(1);
        setSlide((s) => (s + 1) % SLIDES.length);
      }, 5500);
      return () => clearInterval(t);
    }, [paused]);

    useEffect(() => {
      supabase.from("products").select("*").eq("featured", true).eq("active", true).limit(8)
        .then(({ data }) => data && setFeatured(data as Product[]));
      supabase.from("categories").select("*").order("sort_order")
        .then(({ data }) => data && setCategories(data as Category[]));
    }, []);

    const variants = {
      enter: (d: number) => ({ opacity: 0, x: d > 0 ? 60 : -60 }),
      center: { opacity: 1, x: 0 },
      exit: (d: number) => ({ opacity: 0, x: d > 0 ? -60 : 60 }),
    };

    return (
      <Layout>
        {/* HERO SLIDER */}
        <section className="section-dark relative min-h-[92vh] overflow-hidden flex items-center bg-[hsl(0_0%_6%)]">
          {/* Background image with Ken Burns */}
          <motion.div
            key={slide}
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 6, ease: "linear" }}
            className="absolute inset-0 z-0"
          >
            <img
              src={heroImg}
              alt="Vivygold luxury hair"
              className={`size-full object-cover ${SLIDES[slide].pos}`}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/60 to-black/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
          </motion.div>

          {/* Slide content */}
          <div className="container relative z-10 grid lg:grid-cols-2 gap-12 items-center py-20">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={slide}
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px w-12 bg-gold" />
                  <span className="text-[11px] tracking-[0.3em] uppercase text-primary">
                    {SLIDES[slide].tag}
                  </span>
                </div>

                <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl leading-[0.95] mb-6">
                  {SLIDES[slide].headline}
                </h1>

                <p className="text-base sm:text-lg text-muted-foreground max-w-md mb-8 leading-relaxed">
                  {SLIDES[slide].sub}{" "}
                  {slide === 0 && <span className="text-primary">Pay Small Small</span>}
                  {slide === 0 && "."}
                </p>

                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="gold" size="xl">
                    <Link to={SLIDES[slide].cta.to}>
                      {SLIDES[slide].cta.label} <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="goldOutline" size="xl">
                    <Link to="/about">Our story</Link>
                  </Button>
                </div>

                <div className="flex items-center gap-6 mt-12">
                  <div className="flex -space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="size-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-xs tracking-wider text-muted-foreground">
                    <span className="text-foreground font-medium">2,300+</span> exceptional women styled
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="hidden lg:block" />
          </div>

          {/* Prev / Next arrows */}
          <button
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 size-10 grid place-items-center bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm transition-all"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={next}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 size-10 grid place-items-center bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm transition-all"
          >
            <ChevronRight className="size-5" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > slide ? 1 : -1)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-0.5 transition-all duration-500 ${
                  i === slide ? "w-8 bg-primary" : "w-4 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
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
  