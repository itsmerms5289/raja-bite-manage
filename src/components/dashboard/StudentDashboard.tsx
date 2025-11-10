import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { foodImages } from "@/assets/food";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShoppingCart, Search, Leaf, Drumstick, Package, History, Plus, Minus, ShoppingBag } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: string;
  image_url: string | null;
  estimated_prep_time: number;
  is_combo: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface Order {
  id: string;
  status: string;
  total: number;
  placed_at: string;
  order_type: string;
  estimated_ready_at: string | null;
}

const StudentDashboard = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderType, setOrderType] = useState<"dining" | "takeaway">("dining");
  const [specialNotes, setSpecialNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi" | "wallet">("cash");
  const [upiMethod, setUpiMethod] = useState<"gpay" | "phonepe" | "paytm">("gpay");

  useEffect(() => {
    fetchMenuItems();
    fetchOrders();
  }, []);

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_available", true)
        .order("name");

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error: any) {
      toast.error("Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", session.user.id)
        .order("placed_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      toast.error("Failed to load orders");
    }
  };

  const addToCart = (item: MenuItem) => {
    const existingItem = cart.find((i) => i.id === item.id);
    if (existingItem) {
      setCart(cart.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`Added ${item.name} to cart`);
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(
      cart
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + change } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.05;
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleCheckout = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { subtotal, tax, total } = calculateTotal();

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: session.user.id,
          subtotal,
          tax,
          total,
          order_type: orderType,
          special_notes: specialNotes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        line_total: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

      if (itemsError) throw itemsError;

      // Create payment record
      const { error: paymentError } = await supabase.from("payments").insert({
        order_id: order.id,
        method: paymentMethod,
        amount: total,
        status: paymentMethod === "cash" ? "Pending" : "Paid",
      });

      if (paymentError) throw paymentError;

      toast.success("Order placed successfully!");
      setCart([]);
      setCheckoutOpen(false);
      setSpecialNotes("");
      fetchOrders();
    } catch (error: any) {
      toast.error("Failed to place order");
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter || (typeFilter === "combos" && item.is_combo);
    return matchesSearch && matchesType;
  });

  const { subtotal, tax, total } = calculateTotal();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-success text-success-foreground";
      case "Ready":
        return "bg-primary text-primary-foreground";
      case "Preparing":
        return "bg-warning text-warning-foreground";
      case "Denied":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading menu...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="menu" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="menu">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Menu
          </TabsTrigger>
          <TabsTrigger value="orders">
            <History className="h-4 w-4 mr-2" />
            My Orders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={typeFilter === "all" ? "default" : "outline"}
                onClick={() => setTypeFilter("all")}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={typeFilter === "veg" ? "default" : "outline"}
                onClick={() => setTypeFilter("veg")}
                size="sm"
              >
                <Leaf className="h-4 w-4 mr-1" />
                Veg
              </Button>
              <Button
                variant={typeFilter === "non-veg" ? "default" : "outline"}
                onClick={() => setTypeFilter("non-veg")}
                size="sm"
              >
                <Drumstick className="h-4 w-4 mr-1" />
                Non-Veg
              </Button>
              <Button
                variant={typeFilter === "combos" ? "default" : "outline"}
                onClick={() => setTypeFilter("combos")}
                size="sm"
              >
                <Package className="h-4 w-4 mr-1" />
                Combos
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="p-0">
                  <div className="h-48 bg-gradient-to-br from-secondary to-accent flex items-center justify-center overflow-hidden">
                    {item.image_url && foodImages[item.image_url] ? (
                      <img src={foodImages[item.image_url]} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Drumstick className="h-16 w-16 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <Badge variant={item.type === "veg" ? "secondary" : "outline"}>
                      {item.type === "veg" ? <Leaf className="h-3 w-3" /> : <Drumstick className="h-3 w-3" />}
                    </Badge>
                  </div>
                  {item.description && (
                    <CardDescription className="line-clamp-2">{item.description}</CardDescription>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-2xl font-bold text-primary">₹{item.price}</span>
                    <span className="text-xs text-muted-foreground">{item.estimated_prep_time} min</span>
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button onClick={() => addToCart(item)} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No orders yet</p>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
                    <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                  </div>
                  <CardDescription>
                    {new Date(order.placed_at).toLocaleString()} • {order.order_type}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total: ₹{order.total.toFixed(2)}</span>
                    {order.estimated_ready_at && (
                      <span className="text-sm text-muted-foreground">
                        Ready at: {new Date(order.estimated_ready_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {cart.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            size="lg"
            onClick={() => setCheckoutOpen(true)}
            className="rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            View Cart ({cart.length})
          </Button>
        </div>
      )}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>Review your order and complete checkout</DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b pb-4">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">₹{item.price} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => updateQuantity(item.id, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button size="icon" variant="outline" onClick={() => updateQuantity(item.id, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <span className="w-20 text-right font-semibold">₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))}

              <div className="space-y-4 pt-4">
                <div>
                  <Label>Order Type</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={orderType === "dining" ? "default" : "outline"}
                      onClick={() => setOrderType("dining")}
                      className="flex-1"
                    >
                      Dine In
                    </Button>
                    <Button
                      variant={orderType === "takeaway" ? "default" : "outline"}
                      onClick={() => setOrderType("takeaway")}
                      className="flex-1"
                    >
                      Takeaway
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Special Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="e.g., less spicy, no onion"
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {(["cash", "card", "upi", "wallet"] as const).map((method) => (
                      <Button
                        key={method}
                        variant={paymentMethod === method ? "default" : "outline"}
                        onClick={() => setPaymentMethod(method)}
                      >
                        {method.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                  
                  {paymentMethod === "upi" && (
                    <div className="mt-3">
                      <Label className="text-sm">Select UPI App</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {(["gpay", "phonepe", "paytm"] as const).map((method) => (
                          <Button
                            key={method}
                            size="sm"
                            variant={upiMethod === method ? "default" : "outline"}
                            onClick={() => setUpiMethod(method)}
                          >
                            {method === "gpay" ? "GPay" : method === "phonepe" ? "PhonePe" : "Paytm"}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tax (5%):</span>
                    <span>₹{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-primary">₹{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckout}>Place Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentDashboard;
