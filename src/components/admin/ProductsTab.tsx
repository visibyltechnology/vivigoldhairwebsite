import { useEffect, useMemo, useRef, useState } from "react";
import

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0] || !editing) return;
      const file = e.target.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["mp4", "mov", "webm", "m4v"].includes(ext || "")) {
        toast.error("Supported formats: MP4, MOV, WebM");
        return;
      }
      setVideoUploading(true);
      const fileName = `video-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        toast.error(`Video upload failed: ${error.message}`);
      } else {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
        if (urlData?.publicUrl) {
          setEditing((prev) => ({ ...prev, video_url: urlData.publicUrl }));
          toast.success("Video uploaded");
        }
      }
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }; { sb as supabase } from "@/integrations/supabase/admin-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Edit, Trash2, Plus, Search, X, Upload, Loader2, Video, VideoOff } from "lucide-react";

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  hair_type: string | null;
  length_inches: number | null;
  base_currency: "NGN" | "USD";
  price_ngn: number;
  price_usd: number;
  stock: number;
  images: string[];
  video_url: string | null;
  featured: boolean;
  active: boolean;
  category_id: string | null;
}

interface Editing extends Partial<ProductRow> {
  base_price?: number;
}

const BUCKET = "product-images";

export const ProductsTab = ({ rate }: { rate: number }) => {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (data) setProducts(data as ProductRow[]);
  };
  const loadCats = async () => {
    const { data } = await supabase.from("categories").select("id,name").order("sort_order");
    if (data) setCategories(data);
  };

  useEffect(() => {
    load();
    loadCats();
  }, []);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.hair_type || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );

  const startNew = () => {
    setEditing({
      name: "",
      base_currency: "NGN",
      base_price: 0,
      stock: 0,
      images: [],
      active: true,
      hair_type: "Body Wave",
      length_inches: 20,
      brand: "Vivygold",
    });
  };

  const startEdit = (p: ProductRow) => {
    setEditing({
      ...p,
      base_price: p.base_currency === "USD" ? Number(p.price_usd) : Number(p.price_ngn),
    });
  };

  const computePrices = (base_currency: "NGN" | "USD", base_price: number) => {
    const safeRate = rate > 0 ? rate : 1;
    if (base_currency === "NGN") {
      return { price_ngn: base_price, price_usd: Number((base_price / safeRate).toFixed(2)) };
    } else {
      return { price_usd: base_price, price_ngn: Number((base_price * safeRate).toFixed(2)) };
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !editing) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
        toast.error(`${file.name} is not a supported image type`);
        continue;
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        newUrls.push(urlData.publicUrl);
      }
    }

    if (newUrls.length > 0) {
      setEditing((prev) => ({
        ...prev,
        images: [...(prev?.images || []), ...newUrls],
      }));
      toast.success(`${newUrls.length} image${newUrls.length > 1 ? "s" : ""} uploaded`);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setEditing((prev) => ({
      ...prev,
      images: (prev?.images || []).filter((_, i) => i !== index),
    }));
  };

  const saveProduct = async () => {
    if (!editing) return;
    if (!editing.name) return toast.error("Name is required");
    const base_currency = editing.base_currency || "NGN";
    const base_price = Number(editing.base_price || 0);
    const { price_ngn, price_usd } = computePrices(base_currency, base_price);

    const payload = {
      name: editing.name,
      slug: editing.slug || editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      description: editing.description ?? null,
      brand: editing.brand || "Vivygold",
      hair_type: editing.hair_type || null,
      length_inches: editing.length_inches || null,
      base_currency,
      price_ngn,
      price_usd,
      stock: editing.stock || 0,
      images: editing.images || [],
      video_url: editing.video_url ?? null,
      featured: editing.featured || false,
      active: editing.active ?? true,
      category_id: editing.category_id || null,
    };

    const { error } = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);

    if (error) toast.error(error.message);
    else {
      toast.success(editing.id ? "Product updated" : "Product created");
      setEditing(null);
      load();
    }
  };

  const delProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  const toggleActive = async (p: ProductRow) => {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else load();
  };

  const preview = editing
    ? computePrices((editing.base_currency || "NGN") as "NGN" | "USD", Number(editing.base_price || 0))
    : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or hair type"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-card border-border pl-9"
          />
        </div>
        <Button variant="gold" onClick={startNew}>
          <Plus className="size-3" /> New product
        </Button>
      </div>

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Base</th>
              <th className="text-right p-3">₦ NGN</th>
              <th className="text-right p-3">$ USD</th>
              <th className="text-right p-3">Stock</th>
              <th className="text-center p-3">Active</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No products yet — click "New product".
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-card/50">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-muted-foreground text-xs">
                  {p.hair_type} · {p.length_inches}"
                </td>
                <td className="p-3 text-xs uppercase tracking-wider">{p.base_currency}</td>
                <td className="p-3 text-right">₦{Number(p.price_ngn).toLocaleString()}</td>
                <td className="p-3 text-right">${Number(p.price_usd).toLocaleString()}</td>
                <td className="p-3 text-right">{p.stock}</td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => toggleActive(p)}
                    className={`text-xs uppercase tracking-wider px-2 py-0.5 ${
                      p.active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {p.active ? "On" : "Off"}
                  </button>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => startEdit(p)} className="text-primary hover:underline mr-3">
                    <Edit className="size-4 inline" />
                  </button>
                  <button onClick={() => delProduct(p.id)} className="text-destructive hover:underline">
                    <Trash2 className="size-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto p-6"
          onClick={() => setEditing(null)}
        >
          <div
            className="max-w-2xl mx-auto bg-card border border-border p-8 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-3xl mb-6">{editing.id ? "Edit product" : "New product"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="bg-input mt-2"
                />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <textarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                  className="w-full bg-input border border-border p-3 mt-2 text-sm"
                />
              </div>

              <div>
                <Label>Category</Label>
                <Select
                  value={editing.category_id || "none"}
                  onValueChange={(v) => setEditing({ ...editing, category_id: v === "none" ? null : v })}
                >
                  <SelectTrigger className="mt-2 bg-input border-border">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Brand</Label>
                <Input
                  value={editing.brand || ""}
                  onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
                  className="bg-input mt-2"
                />
              </div>

              <div>
                <Label>Hair type</Label>
                <Input
                  value={editing.hair_type || ""}
                  onChange={(e) => setEditing({ ...editing, hair_type: e.target.value })}
                  className="bg-input mt-2"
                />
              </div>
              <div>
                <Label>Length (inches)</Label>
                <Input
                  type="number"
                  value={editing.length_inches || ""}
                  onChange={(e) => setEditing({ ...editing, length_inches: Number(e.target.value) })}
                  className="bg-input mt-2"
                />
              </div>

              <div>
                <Label>Price currency</Label>
                <Select
                  value={editing.base_currency || "NGN"}
                  onValueChange={(v) => setEditing({ ...editing, base_currency: v as "NGN" | "USD" })}
                >
                  <SelectTrigger className="mt-2 bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">₦ Naira (NGN)</SelectItem>
                    <SelectItem value="USD">$ Dollar (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price ({editing.base_currency || "NGN"})</Label>
                <Input
                  type="number"
                  value={editing.base_price ?? 0}
                  onChange={(e) => setEditing({ ...editing, base_price: Number(e.target.value) })}
                  className="bg-input mt-2"
                />
              </div>

              <div className="col-span-2 text-xs text-muted-foreground bg-background/40 border border-border p-3">
                Auto-converted at current rate (1 USD = ₦{rate.toLocaleString()}):{" "}
                <span className="text-foreground">
                  ₦{Number(preview?.price_ngn || 0).toLocaleString()} · ${Number(preview?.price_usd || 0).toLocaleString()}
                </span>
              </div>

              <div>
                <Label>Stock</Label>
                <Input
                  type="number"
                  value={editing.stock || 0}
                  onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })}
                  className="bg-input mt-2"
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.featured || false}
                    onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
                  />{" "}
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.active ?? true}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />{" "}
                  Active
                </label>
              </div>

              <div className="col-span-2">
                <Label>Product Images</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Accepted formats: PNG, JPG, JPEG, WebP. You can select multiple files at once.
                </p>

                <div
                  className="border-2 border-dashed border-border rounded-sm p-6 text-center cursor-pointer hover:border-primary transition-colors mt-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-6 animate-spin" />
                      <span className="text-sm">Uploading…</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload className="size-6" />
                      <span className="text-sm">Click to select image files</span>
                      <span className="text-xs">PNG, JPG, JPEG, WebP</span>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />

                {(editing.images || []).length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {(editing.images || []).map((url, i) => (
                      <div key={i} className="relative group aspect-square">
                        <img
                          src={url}
                          alt={`Product image ${i + 1}`}
                          className="w-full h-full object-cover border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

                {/* ── Product Video (optional) ── */}
                <div className="col-span-2 mt-4">
                  <Label>Product Video <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    Short clip showing texture or styling. MP4, MOV or WebM recommended.
                  </p>
                  {editing.video_url ? (
                    <div className="space-y-2">
                      <video src={editing.video_url} controls className="w-full max-h-48 border border-border bg-black object-contain" />
                      <button
                        type="button"
                        onClick={() => setEditing((prev) => ({ ...prev, video_url: null }))}
                        className="flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <VideoOff className="size-3" /> Remove video
                      </button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-border rounded-sm p-5 text-center cursor-pointer hover:border-primary transition-colors"
                      onClick={() => videoInputRef.current?.click()}
                    >
                      {videoUploading ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="size-5 animate-spin" />
                          <span className="text-sm">Uploading video…</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Video className="size-5" />
                          <span className="text-sm">Click to upload a product video</span>
                          <span className="text-xs">MP4 · MOV · WebM</span>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                    className="hidden"
                    onChange={handleVideoUpload}
                  />
                </div>
            <div className="flex gap-3 mt-6 justify-end">
              <Button variant="luxe" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="gold" onClick={saveProduct} disabled={uploading}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
