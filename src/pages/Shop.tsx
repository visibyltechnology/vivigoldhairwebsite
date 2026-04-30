import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ProductCard } from "@/components/shop/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import type { Product, Category } from "@/lib/products";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const Shop = () => {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { currency } = useCurrency();

  const cat = params.get("cat") || "";
  const q = params.get("q") || "";
  const [search, setSearch] = useState(q);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, currency === "NGN" ? 1000000 : 1000]);
  const [length, setLength] = useState<string>("");
  const [hairType, setHairType] = useState<string>("");
  const [sort, setSort] = useState<string>("featured");

  useEffect(() => {
    supabase.from("categories").select("*").order("sort_order").then(({ data }) => data && setCategories(data as Category[]));
  }, []);

  useEffect(() => {
    setLoading(true);
    let query = supabase.from("products").select("*").eq("active", true);
    if (cat) {
      const found = categories.find((c) => c.slug === cat);
      if (found) query = query.eq("category_id", found.id);
    }
    query.then(({ data }) => {
      setProducts((data as Product[]) || []);
      setLoading(false);
    });
  }, [cat, categories]);

  useEffect(() => {
    setPriceRange([0, currency === "NGN" ? 1000000 : 1000]);
  }, [currency]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (q) {
      const lq = q.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(lq) || p.description?.toLowerCase().includes(lq));
    }
    list = list.filter((p) => {
      const price = currency === "NGN" ? p.price_ngn : p.price_usd;
      return price >= priceRange[0] && price <= priceRange[1];
    });
    if (length) list = list.filter((p) => p.length_inches === Number(length));
    if (hairType) list = list.filter((p) => p.hair_type === hairType);
    switch (sort) {
      case "price-asc": list.sort((a, b) => a.price_ngn - b.price_ngn); break;
      case "price-desc": list.sort((a, b) => b.price_ngn - a.price_ngn); break;
      case "newest": list.sort((a, b) => Number(b.featured) - Number(a.featured)); break;
      default: list.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return list;
  }, [products, q, priceRange, length, hairType, sort, currency]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  const lengths = [...new Set(products.map((p) => p.length_inches).filter(Boolean))].sort((a, b) => (a as number) - (b as number));
  const types = [...new Set(products.map((p) => p.hair_type).filter(Boolean))];

  const FilterSidebar = (
    <aside className="space-y-8">
      <div>
        <h3 className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Category</h3>
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => updateParam("cat", "")}
              className={`text-sm ${!cat ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              All collection
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => updateParam("cat", c.slug)}
                className={`text-sm ${cat === c.slug ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Price ({currency})</h3>
        <Slider
          min={0}
          max={currency === "NGN" ? 1000000 : 1000}
          step={currency === "NGN" ? 10000 : 10}
          value={priceRange}
          onValueChange={(v) => setPriceRange(v as [number, number])}
          className="mb-3"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{currency === "NGN" ? "₦" : "$"}{priceRange[0].toLocaleString()}</span>
          <span>{currency === "NGN" ? "₦" : "$"}{priceRange[1].toLocaleString()}</span>
        </div>
      </div>

      {lengths.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Length</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setLength("")} className={`text-xs px-3 py-1.5 border ${!length ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>All</button>
            {lengths.map((l) => (
              <button
                key={l}
                onClick={() => setLength(String(l))}
                className={`text-xs px-3 py-1.5 border ${String(l) === length ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                {l}"
              </button>
            ))}
          </div>
        </div>
      )}

      {types.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Texture</h3>
          <ul className="space-y-2">
            <li>
              <button onClick={() => setHairType("")} className={`text-sm ${!hairType ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>All textures</button>
            </li>
            {types.map((t) => (
              <li key={t}>
                <button onClick={() => setHairType(t || "")} className={`text-sm ${hairType === t ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );

  return (
    <Layout>
      <section className="border-b border-border">
        <div className="container py-16 text-center">
          <span className="text-[11px] tracking-[0.3em] uppercase text-primary">The boutique</span>
          <h1 className="font-display text-5xl md:text-7xl mt-3">
            {cat ? categories.find((c) => c.slug === cat)?.name || "Shop" : "Everything"}
          </h1>
        </div>
      </section>

      <div className="container py-12 grid lg:grid-cols-[260px_1fr] gap-12">
        <div className="hidden lg:block">{FilterSidebar}</div>

        <div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-8 pb-6 border-b border-border">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search the collection..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && updateParam("q", search)}
                className="pl-10 bg-card border-border"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="luxe" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal className="size-3" /> Filters
              </Button>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-card border border-border px-3 py-2 text-xs uppercase tracking-widest"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
              </select>
            </div>
          </div>

          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-6">{filtered.length} pieces</p>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-12">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-card animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-32">
              <p className="font-display text-3xl mb-2">Nothing found</p>
              <p className="text-muted-foreground">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-12">
              {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl lg:hidden overflow-y-auto">
          <div className="container py-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-3xl">Filters</h2>
              <button onClick={() => setFiltersOpen(false)}><X className="size-5" /></button>
            </div>
            {FilterSidebar}
            <Button variant="gold" className="w-full mt-8" onClick={() => setFiltersOpen(false)}>Apply</Button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Shop;
