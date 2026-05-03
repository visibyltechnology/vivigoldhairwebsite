export interface Product {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    category_id: string | null;
    brand: string | null;
    hair_type: string | null;
    length_inches: number | null;
    price_ngn: number;
    price_usd: number;
    compare_price_ngn: number | null;
    compare_price_usd: number | null;
    stock: number;
    images: string[];
    video_url: string | null;
    featured: boolean;
    active: boolean;
    category?: { name: string; slug: string } | null;
  }

  export interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    sort_order: number;
  }

  import bodywave from "@/assets/product-bodywave.jpg";
  import straight from "@/assets/product-straight.jpg";
  import curly from "@/assets/product-curly.jpg";
  import bundles from "@/assets/product-bundles.jpg";
  import closure from "@/assets/product-closure.jpg";
  import braids from "@/assets/product-braids.jpg";
  import hero from "@/assets/hero-model.jpg";

  const map: Record<string, string> = {
    "/src/assets/product-bodywave.jpg": bodywave,
    "/src/assets/product-straight.jpg": straight,
    "/src/assets/product-curly.jpg": curly,
    "/src/assets/product-bundles.jpg": bundles,
    "/src/assets/product-closure.jpg": closure,
    "/src/assets/product-braids.jpg": braids,
    "/src/assets/hero-model.jpg": hero,
  };

  export const resolveImage = (src?: string | null): string => {
    if (!src) return bodywave;
    if (map[src]) return map[src];
    return src;
  };

  export const PLACEHOLDER_IMAGE = bodywave;
  