import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit, Trash2, BarChart3, Settings, UtensilsCrossed, QrCode, Upload } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: string;
  image_url: string | null;
  estimated_prep_time: number;
  is_available: boolean;
  is_combo: boolean;
}

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
}

const ManagerDashboard = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    completedOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    type: "veg" as "veg" | "non-veg" | "snacks",
    estimated_prep_time: "15",
    is_available: true,
    is_combo: false,
  });
  const [upiQrUrl, setUpiQrUrl] = useState<string>("");
  const [newQrUrl, setNewQrUrl] = useState<string>("");
  const [savingQr, setSavingQr] = useState(false);

  useEffect(() => {
    fetchData();
    fetchQrSettings();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([fetchMenuItems(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchQrSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "upi_qr_url")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      if (data?.value) {
        setUpiQrUrl(data.value);
        setNewQrUrl(data.value);
      }
    } catch (error: any) {
      console.error("Failed to load QR settings");
    }
  };

  const handleSaveQr = async () => {
    setSavingQr(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from("app_settings")
        .update({ value: newQrUrl, updated_at: new Date().toISOString(), updated_by: session?.user?.id })
        .eq("key", "upi_qr_url");

      if (error) throw error;
      
      setUpiQrUrl(newQrUrl);
      toast.success("UPI QR code updated successfully");
    } catch (error: any) {
      toast.error("Failed to update QR code");
    } finally {
      setSavingQr(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase.from("menu_items").select("*").order("name");

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error: any) {
      toast.error("Failed to load menu items");
    }
  };

  const fetchStats = async () => {
    try {
      const { data: orders, error } = await supabase.from("orders").select("status, total");

      if (error) throw error;

      const stats = {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
        pendingOrders: orders.filter((o) => o.status === "Pending").length,
        completedOrders: orders.filter((o) => o.status === "Completed").length,
      };

      setStats(stats);
    } catch (error: any) {
      toast.error("Failed to load statistics");
    }
  };

  const handleEdit = (item: MenuItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      type: item.type as "veg" | "non-veg",
      estimated_prep_time: item.estimated_prep_time.toString(),
      is_available: item.is_available,
      is_combo: item.is_combo,
    });
    setEditDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedItem(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      type: "veg",
      estimated_prep_time: "15",
      is_available: true,
      is_combo: false,
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const itemData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        type: formData.type,
        estimated_prep_time: parseInt(formData.estimated_prep_time),
        is_available: formData.is_available,
        is_combo: formData.is_combo,
      };

      if (selectedItem) {
        const { error } = await supabase.from("menu_items").update(itemData).eq("id", selectedItem.id);

        if (error) throw error;
        toast.success("Menu item updated");
      } else {
        const { error } = await supabase.from("menu_items").insert(itemData);

        if (error) throw error;
        toast.success("Menu item added");
      }

      setEditDialogOpen(false);
      fetchMenuItems();
    } catch (error: any) {
      toast.error("Failed to save menu item");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);

      if (error) throw error;
      toast.success("Menu item deleted");
      fetchMenuItems();
    } catch (error: any) {
      toast.error("Failed to delete menu item");
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success("Availability updated");
      fetchMenuItems();
    } catch (error: any) {
      toast.error("Failed to update availability");
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Manager Dashboard</h2>
      </div>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-2" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="menu">
            <UtensilsCrossed className="h-4 w-4 mr-2" />
            Menu Management
          </TabsTrigger>
          <TabsTrigger value="settings">
            <QrCode className="h-4 w-4 mr-2" />
            Payment QR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Orders</CardDescription>
                <CardTitle className="text-3xl">{stats.totalOrders}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Revenue</CardDescription>
                <CardTitle className="text-3xl text-success">₹{stats.totalRevenue.toFixed(2)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Orders</CardDescription>
                <CardTitle className="text-3xl text-warning">{stats.pendingOrders}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Completed Orders</CardDescription>
                <CardTitle className="text-3xl text-primary">{stats.completedOrders}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="menu" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Menu Item
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {menuItems.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={item.type === "veg" ? "secondary" : "outline"}>{item.type}</Badge>
                    {item.is_combo && <Badge>Combo</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-primary">₹{item.price}</span>
                    <span className="text-sm text-muted-foreground">{item.estimated_prep_time} min</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <Label htmlFor={`available-${item.id}`}>Available</Label>
                    <Switch
                      id={`available-${item.id}`}
                      checked={item.is_available}
                      onCheckedChange={() => toggleAvailability(item.id, item.is_available)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                UPI Payment QR Code
              </CardTitle>
              <CardDescription>
                Upload or update your UPI QR code for customers to scan during payment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="qr-url">QR Code Image URL</Label>
                    <Input
                      id="qr-url"
                      placeholder="https://example.com/your-qr-code.png"
                      value={newQrUrl}
                      onChange={(e) => setNewQrUrl(e.target.value)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the URL of your UPI QR code image
                    </p>
                  </div>
                  <Button 
                    onClick={handleSaveQr} 
                    disabled={savingQr || newQrUrl === upiQrUrl}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {savingQr ? "Saving..." : "Save QR Code"}
                  </Button>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-muted/50">
                  {upiQrUrl ? (
                    <div className="space-y-2 text-center">
                      <img 
                        src={upiQrUrl} 
                        alt="UPI QR Code" 
                        className="max-w-[200px] max-h-[200px] rounded-lg border shadow-sm"
                      />
                      <p className="text-sm text-muted-foreground">Current QR Code</p>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <QrCode className="h-16 w-16 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">No QR code set</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
            <DialogDescription>Fill in the details for the menu item</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Price (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="prep-time">Prep Time (minutes) *</Label>
                <Input
                  id="prep-time"
                  type="number"
                  min="1"
                  value={formData.estimated_prep_time}
                  onChange={(e) => setFormData({ ...formData, estimated_prep_time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "veg" | "non-veg" | "snacks") => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veg">Vegetarian</SelectItem>
                  <SelectItem value="non-veg">Non-Vegetarian</SelectItem>
                  <SelectItem value="snacks">Snacks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="available"
                checked={formData.is_available}
                onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
              />
              <Label htmlFor="available">Available</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="combo"
                checked={formData.is_combo}
                onCheckedChange={(checked) => setFormData({ ...formData, is_combo: checked })}
              />
              <Label htmlFor="combo">Combo Item</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.price}>
              {selectedItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerDashboard;
