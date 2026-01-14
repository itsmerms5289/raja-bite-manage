import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ChefHat, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  user_id: string;
  status: string;
  total: number;
  order_type: string;
  special_notes: string | null;
  placed_at: string;
  profiles: {
    name: string;
  };
}

const MakerDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [denyReason, setDenyReason] = useState("");
  const [showDenyDialog, setShowDenyDialog] = useState(false);

  useEffect(() => {
    fetchOrders();

    // Subscribe to order changes
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles!orders_user_id_fkey(name)")
        .in("status", ["Pending", "Accepted", "Preparing", "Ready"])
        .order("placed_at", { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      if (error) throw error;
      setOrderItems(data || []);
    } catch (error: any) {
      toast.error("Failed to load order items");
    }
  };

  const handleOrderClick = async (order: Order) => {
    setSelectedOrder(order);
    await fetchOrderItems(order.id);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const updateData: any = { status };
      if (status === "Accepted") {
        updateData.maker_id = session.user.id;
        // Estimate ready time as 30 minutes from now
        const estimatedTime = new Date();
        estimatedTime.setMinutes(estimatedTime.getMinutes() + 30);
        updateData.estimated_ready_at = estimatedTime.toISOString();
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);

      if (error) throw error;

      toast.success(`Order ${status.toLowerCase()}`);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error: any) {
      toast.error("Failed to update order");
    }
  };

  const handleDenyOrder = async () => {
    if (!selectedOrder) return;

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "Denied",
          special_notes: denyReason,
        })
        .eq("id", selectedOrder.id);

      if (error) throw error;

      toast.success("Order denied");
      setShowDenyDialog(false);
      setSelectedOrder(null);
      setDenyReason("");
      fetchOrders();
    } catch (error: any) {
      toast.error("Failed to deny order");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-success text-success-foreground";
      case "Ready":
        return "bg-primary text-primary-foreground";
      case "Preparing":
      case "Accepted":
        return "bg-warning text-warning-foreground";
      case "Denied":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Ready":
        return <CheckCircle className="h-4 w-4" />;
      case "Preparing":
      case "Accepted":
        return <Clock className="h-4 w-4" />;
      case "Pending":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "Pending");
  const activeOrders = orders.filter((o) => ["Accepted", "Preparing", "Ready"].includes(o.status));

  if (loading) {
    return <div className="text-center py-12">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ChefHat className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Kitchen Dashboard</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Pending Orders ({pendingOrders.length})
          </h3>
          {pendingOrders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <p className="text-muted-foreground">No pending orders</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                {pendingOrders.map((order) => (
              <Card
                key={order.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleOrderClick(order)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Order #{order.id.slice(0, 8)}</CardTitle>
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1">{order.status}</span>
                    </Badge>
                  </div>
                  <CardDescription>
                    {order.profiles?.name ?? "Customer"} • {order.order_type} • {new Date(order.placed_at).toLocaleTimeString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">₹{order.total.toFixed(2)}</p>
                  {order.special_notes && (
                    <p className="text-sm text-muted-foreground mt-2">Note: {order.special_notes}</p>
                  )}
                </CardContent>
                </Card>
              ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Active Orders ({activeOrders.length})
          </h3>
          {activeOrders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <p className="text-muted-foreground">No active orders</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {activeOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleOrderClick(order)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Order #{order.id.slice(0, 8)}</CardTitle>
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusIcon(order.status)}
                          <span className="ml-1">{order.status}</span>
                        </Badge>
                      </div>
                      <CardDescription>
                        {order.profiles?.name ?? "Customer"} • {order.order_type} • {new Date(order.placed_at).toLocaleTimeString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold">₹{order.total.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Order #{selectedOrder?.id.slice(0, 8)} • {selectedOrder?.profiles?.name ?? "Customer"}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge className={getStatusColor(selectedOrder.status)}>{selectedOrder.status}</Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(selectedOrder.placed_at).toLocaleString()}
                </span>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Order Items</h4>
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold">₹{(item.unit_price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center border-t pt-4">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-primary">₹{selectedOrder.total.toFixed(2)}</span>
              </div>

              {selectedOrder.special_notes && (
                <div className="bg-secondary p-3 rounded-md">
                  <p className="text-sm font-medium mb-1">Special Notes:</p>
                  <p className="text-sm">{selectedOrder.special_notes}</p>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Order Type:</span>
                <Badge variant="outline">{selectedOrder.order_type}</Badge>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedOrder?.status === "Pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setShowDenyDialog(true)}
                  className="w-full sm:w-auto"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Deny Order
                </Button>
                <Button
                  onClick={() => updateOrderStatus(selectedOrder.id, "Accepted")}
                  className="w-full sm:w-auto"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Order
                </Button>
              </>
            )}
            {selectedOrder?.status === "Accepted" && (
              <Button
                onClick={() => updateOrderStatus(selectedOrder.id, "Preparing")}
                className="w-full sm:w-auto"
              >
                <Clock className="h-4 w-4 mr-2" />
                Start Preparing
              </Button>
            )}
            {selectedOrder?.status === "Preparing" && (
              <Button onClick={() => updateOrderStatus(selectedOrder.id, "Ready")} className="w-full sm:w-auto">
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Ready
              </Button>
            )}
            {selectedOrder?.status === "Ready" && (
              <Button
                onClick={() => updateOrderStatus(selectedOrder.id, "Completed")}
                className="w-full sm:w-auto"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Order
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Order</DialogTitle>
            <DialogDescription>Please provide a reason for denying this order</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deny-reason">Reason</Label>
              <Textarea
                id="deny-reason"
                placeholder="e.g., Items not available, kitchen closed"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="mt-2"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDenyDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDenyOrder} disabled={!denyReason}>
              Deny Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MakerDashboard;
