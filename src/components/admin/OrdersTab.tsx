import { useEffect, useMemo, useState } from "react";
import { sb as supabase } from "@/integrations/supabase/admin-client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, ChevronDown, ChevronRight, MapPin } from "lucide-react";

interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  currency: "NGN" | "USD";
  subtotal: number;
  shipping_fee: number;
  total: number;
  status: string;
  payment_status: string;
  is_installment: boolean;
  amount_paid: number;
  amount_remaining: number;
  installment_status: string | null;
  installment_parts: number | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  product_image: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

interface ShippingAddress {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
}

const statusColors: Record<string, string> = {
  pending: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  processing: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  shipped: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  delivered: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  cancelled: "text-red-400 border-red-400/30 bg-red-400/10",
  paid: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  partial: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  unpaid: "text-red-400 border-red-400/30 bg-red-400/10",
  refunded: "text-muted-foreground border-border bg-card",
  failed: "text-red-400 border-red-400/30 bg-red-400/10",
};

const Pill = ({ value }: { value: string }) => (
  <span className={`inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 border ${statusColors[value] || "text-muted-foreground border-border"}`}>
    {value}
  </span>
);

export const OrdersTab = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [shippingAddresses, setShippingAddresses] = useState<Record<string, ShippingAddress>>({});

  const load = async () => {
    const { data } = await supabase
      .from("admin_order_summary")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOrders(data as Order[]);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        if (statusFilter !== "all" && o.status !== statusFilter) return false;
        if (paymentFilter !== "all" && o.payment_status !== paymentFilter) return false;
        if (
          search &&
          !o.order_number.toLowerCase().includes(search.toLowerCase()) &&
          !o.customer_name?.toLowerCase().includes(search.toLowerCase()) &&
          !o.customer_email?.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [orders, search, statusFilter, paymentFilter],
  );

  const toggleExpand = async (orderId: string) => {
    if (expanded === orderId) {
      setExpanded(null);
      return;
    }
    setExpanded(orderId);

    const fetchPromises: Promise<void>[] = [];

    if (!items[orderId]) {
      fetchPromises.push(
        supabase
          .from("order_items")
          .select("*")
          .eq("order_id", orderId)
          .then(({ data }) => {
            if (data) setItems((prev) => ({ ...prev, [orderId]: data as OrderItem[] }));
          })
      );
    }

    if (!shippingAddresses[orderId]) {
      fetchPromises.push(
        supabase
          .from("orders")
          .select("shipping_address")
          .eq("id", orderId)
          .single()
          .then(({ data }) => {
            if (data?.shipping_address) {
              setShippingAddresses((prev) => ({
                ...prev,
                [orderId]: data.shipping_address as ShippingAddress,
              }));
            }
          })
      );
    }

    await Promise.all(fetchPromises);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Order status updated");
      load();
    }
  };

  const updatePayment = async (id: string, payment_status: string) => {
    const { error } = await supabase.from("orders").update({ payment_status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Payment status updated");
      load();
    }
  };

  const sym = (c: string) => (c === "NGN" ? "₦" : "$");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search order #, name, email" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-card border-border pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px] bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[170px] bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="paid">Paid in full</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8"></th>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-right p-3">Total</th>
              <th className="text-right p-3">Paid</th>
              <th className="text-right p-3">Owed</th>
              <th className="text-left p-3">Payment</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No orders match these filters.
                </td>
              </tr>
            )}
            {filtered.map((o) => (
              <>
                <tr key={o.id} className="hover:bg-card/50 cursor-pointer" onClick={() => toggleExpand(o.id)}>
                  <td className="p-3 text-muted-foreground">
                    {expanded === o.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </td>
                  <td className="p-3 font-medium">
                    {o.order_number}
                    {o.is_installment && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">
                        Installment {o.installment_parts ? `· ${o.installment_parts} parts` : ""}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div>{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{o.customer_email}</div>
                  </td>
                  <td className="p-3 text-right">{sym(o.currency)}{Number(o.total).toLocaleString()}</td>
                  <td className="p-3 text-right text-emerald-400">{sym(o.currency)}{Number(o.amount_paid).toLocaleString()}</td>
                  <td className="p-3 text-right text-yellow-400">{sym(o.currency)}{Number(o.amount_remaining).toLocaleString()}</td>
                  <td className="p-3"><Pill value={o.payment_status} /></td>
                  <td className="p-3"><Pill value={o.status} /></td>
                  <td className="p-3 text-xs whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>

                {expanded === o.id && (
                  <tr className="bg-background/40">
                    <td colSpan={9} className="p-5">
                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-5">
                          <div>
                            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Items</h4>
                            <div className="space-y-2">
                              {(items[o.id] || []).map((it) => (
                                <div key={it.id} className="flex justify-between text-sm border border-border bg-card px-3 py-2">
                                  <span>
                                    {it.product_name} <span className="text-muted-foreground">× {it.quantity}</span>
                                  </span>
                                  <span>{sym(o.currency)}{Number(it.line_total).toLocaleString()}</span>
                                </div>
                              ))}
                              {(items[o.id]?.length ?? 0) === 0 && (
                                <div className="text-xs text-muted-foreground">Loading items…</div>
                              )}
                            </div>
                            <div className="mt-3 text-xs text-muted-foreground">
                              Subtotal {sym(o.currency)}{Number(o.subtotal).toLocaleString()} · Shipping {sym(o.currency)}{Number(o.shipping_fee).toLocaleString()}
                            </div>
                          </div>

                          {/* Delivery details */}
                          <div>
                            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                              <MapPin className="size-3" /> Delivery details
                            </h4>
                            {shippingAddresses[o.id] ? (
                              <div className="border border-border bg-card px-4 py-3 space-y-1.5 text-sm">
                                {shippingAddresses[o.id].address && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground w-16 shrink-0">Address</span>
                                    <span>{shippingAddresses[o.id].address}</span>
                                  </div>
                                )}
                                {shippingAddresses[o.id].city && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground w-16 shrink-0">City</span>
                                    <span>{shippingAddresses[o.id].city}</span>
                                  </div>
                                )}
                                {shippingAddresses[o.id].state && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground w-16 shrink-0">State</span>
                                    <span>{shippingAddresses[o.id].state}</span>
                                  </div>
                                )}
                                {shippingAddresses[o.id].country && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground w-16 shrink-0">Country</span>
                                    <span>{shippingAddresses[o.id].country}</span>
                                  </div>
                                )}
                                {shippingAddresses[o.id].notes && (
                                  <div className="flex gap-2 pt-1 border-t border-border mt-1">
                                    <span className="text-muted-foreground w-16 shrink-0">Notes</span>
                                    <span className="text-muted-foreground italic">{shippingAddresses[o.id].notes}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">Loading delivery details…</div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Update</h4>
                          <div>
                            <label className="text-xs text-muted-foreground">Order status</label>
                            <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                              <SelectTrigger className="mt-1 bg-card border-border"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Payment status</label>
                            <Select value={o.payment_status} onValueChange={(v) => updatePayment(o.id, v)}>
                              <SelectTrigger className="mt-1 bg-card border-border"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="refunded">Refunded</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {o.customer_phone && (
                            <a
                              href={`https://wa.me/${o.customer_phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <Button variant="luxe" className="w-full">WhatsApp customer</Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
