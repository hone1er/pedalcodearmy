"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  ShoppingCart,
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Plus,
  Trash2,
  Edit,
} from "lucide-react";

// Types
interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  costToMake: number;
  salePrice: number;
  reorderLevel: number;
}

interface Order {
  id: string;
  date: string;
  customer: string;
  email: string;
  product: string;
  quantity: number;
  total: number;
  cost: number;
  status: "pending" | "shipped" | "delivered";
}

interface ContentItem {
  id: string;
  date: string;
  platform: "tiktok" | "instagram" | "both";
  type: "video" | "photo" | "reel" | "story";
  topic: string;
  product: string;
  status: "idea" | "planned" | "created" | "posted";
  notes: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  notes: string;
}

// Initial data
const initialInventory: InventoryItem[] = [
  {
    id: "1",
    name: "Honda Hobbit Fork Spacers",
    sku: "PCA-FS-001",
    stock: 10,
    costToMake: 8,
    salePrice: 25,
    reorderLevel: 5,
  },
  {
    id: "2",
    name: "Honda Hobbit Chain Tensioner",
    sku: "PCA-CT-001",
    stock: 8,
    costToMake: 6,
    salePrice: 20,
    reorderLevel: 5,
  },
  {
    id: "3",
    name: "Racing Airbox for Mopeds (RAM)",
    sku: "PCA-RAM-001",
    stock: 0,
    costToMake: 15,
    salePrice: 0,
    reorderLevel: 3,
  },
];

const initialOrders: Order[] = [];

const initialContent: ContentItem[] = [
  {
    id: "1",
    date: "",
    platform: "both",
    type: "video",
    topic: "Moped restoration time-lapse",
    product: "General",
    status: "idea",
    notes: "Show full restoration process sped up",
  },
  {
    id: "2",
    date: "",
    platform: "tiktok",
    type: "video",
    topic: "3D printing process - Fork Spacers",
    product: "Fork Spacers",
    status: "idea",
    notes: "Satisfying print footage with explanation",
  },
  {
    id: "3",
    date: "",
    platform: "instagram",
    type: "reel",
    topic: "Before/After fork stability test",
    product: "Fork Spacers",
    status: "idea",
    notes: "Show the difference spacers make",
  },
  {
    id: "4",
    date: "",
    platform: "both",
    type: "video",
    topic: "Airbox teaser - Coming Soon",
    product: "RAM Airbox",
    status: "idea",
    notes: "Build hype for airbox launch",
  },
];

const initialCustomers: Customer[] = [];

type TabType = "overview" | "inventory" | "orders" | "content" | "customers";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [content, setContent] = useState<ContentItem[]>(initialContent);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);

  // Load from localStorage on mount
  useEffect(() => {
    const savedInventory = localStorage.getItem("pca_inventory");
    const savedOrders = localStorage.getItem("pca_orders");
    const savedContent = localStorage.getItem("pca_content");
    const savedCustomers = localStorage.getItem("pca_customers");

    if (savedInventory) setInventory(JSON.parse(savedInventory));
    if (savedOrders) setOrders(JSON.parse(savedOrders));
    if (savedContent) setContent(JSON.parse(savedContent));
    if (savedCustomers) setCustomers(JSON.parse(savedCustomers));
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem("pca_inventory", JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem("pca_orders", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem("pca_content", JSON.stringify(content));
  }, [content]);

  useEffect(() => {
    localStorage.setItem("pca_customers", JSON.stringify(customers));
  }, [customers]);

  // Calculate stats
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const totalProfit = orders.reduce((sum, o) => sum + (o.total - o.cost), 0);
  const totalOrders = orders.length;
  const totalCustomers = customers.length;
  const lowStockItems = inventory.filter((i) => i.stock <= i.reorderLevel);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "inventory", label: "Inventory", icon: <Package className="h-4 w-4" /> },
    { id: "orders", label: "Orders", icon: <ShoppingCart className="h-4 w-4" /> },
    { id: "content", label: "Content", icon: <Calendar className="h-4 w-4" /> },
    { id: "customers", label: "Customers", icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-black text-white">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-black uppercase tracking-tight text-[#FFD700]">
            Pedal Code Army - Admin Dashboard
          </h1>
          <p className="text-sm text-gray-400">Business Management System</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4">
          <nav className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-[#FFD700] text-black"
                    : "border-transparent text-gray-500 hover:text-black"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {activeTab === "overview" && (
          <OverviewTab
            totalRevenue={totalRevenue}
            totalProfit={totalProfit}
            totalOrders={totalOrders}
            totalCustomers={totalCustomers}
            inventory={inventory}
            lowStockItems={lowStockItems}
            recentOrders={orders.slice(-5).reverse()}
          />
        )}
        {activeTab === "inventory" && (
          <InventoryTab inventory={inventory} setInventory={setInventory} />
        )}
        {activeTab === "orders" && (
          <OrdersTab
            orders={orders}
            setOrders={setOrders}
            inventory={inventory}
            customers={customers}
            setCustomers={setCustomers}
          />
        )}
        {activeTab === "content" && (
          <ContentTab content={content} setContent={setContent} />
        )}
        {activeTab === "customers" && (
          <CustomersTab customers={customers} setCustomers={setCustomers} />
        )}
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({
  totalRevenue,
  totalProfit,
  totalOrders,
  totalCustomers,
  inventory,
  lowStockItems,
  recentOrders,
}: {
  totalRevenue: number;
  totalProfit: number;
  totalOrders: number;
  totalCustomers: number;
  inventory: InventoryItem[];
  lowStockItems: InventoryItem[];
  recentOrders: Order[];
}) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          icon={<DollarSign className="h-6 w-6" />}
          color="bg-green-500"
        />
        <StatCard
          title="Total Profit"
          value={`$${totalProfit.toFixed(2)}`}
          icon={<TrendingUp className="h-6 w-6" />}
          color="bg-blue-500"
        />
        <StatCard
          title="Total Orders"
          value={totalOrders.toString()}
          icon={<ShoppingCart className="h-6 w-6" />}
          color="bg-purple-500"
        />
        <StatCard
          title="Customers"
          value={totalCustomers.toString()}
          icon={<Users className="h-6 w-6" />}
          color="bg-orange-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inventory Status */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 text-lg font-bold">Inventory Status</h3>
            <div className="space-y-3">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.sku}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${
                        item.stock <= item.reorderLevel
                          ? "text-red-500"
                          : "text-green-600"
                      }`}
                    >
                      {item.stock} in stock
                    </p>
                    {item.stock <= item.reorderLevel && (
                      <p className="text-xs text-red-500">Low stock!</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 text-lg font-bold">Alerts</h3>
            {lowStockItems.length > 0 ? (
              <div className="space-y-2">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded border-l-4 border-red-500 bg-red-50 p-3"
                  >
                    <p className="font-medium text-red-700">
                      {item.name} - Low Stock ({item.stock} remaining)
                    </p>
                    <p className="text-sm text-red-600">
                      Reorder level: {item.reorderLevel}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No alerts - all stock levels are good!</p>
            )}

            <h3 className="mb-4 mt-6 text-lg font-bold">Recent Orders</h3>
            {recentOrders.length > 0 ? (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded border p-2"
                  >
                    <div>
                      <p className="font-medium">{order.customer}</p>
                      <p className="text-xs text-gray-500">{order.product}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${order.total}</p>
                      <span
                        className={`text-xs ${
                          order.status === "delivered"
                            ? "text-green-600"
                            : order.status === "shipped"
                              ? "text-blue-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No orders yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`rounded-lg p-3 text-white ${color}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Inventory Tab
function InventoryTab({
  inventory,
  setInventory,
}: {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const handleSave = () => {
    if (editingId && editForm) {
      setInventory((prev) =>
        prev.map((item) =>
          item.id === editingId ? { ...item, ...editForm } : item
        )
      );
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleAddItem = () => {
    const newItem: InventoryItem = {
      id: Date.now().toString(),
      name: "New Product",
      sku: "PCA-NEW-001",
      stock: 0,
      costToMake: 0,
      salePrice: 0,
      reorderLevel: 5,
    };
    setInventory((prev) => [...prev, newItem]);
    handleEdit(newItem);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Inventory Management</h2>
        <button
          onClick={handleAddItem}
          className="flex items-center gap-2 rounded bg-black px-4 py-2 text-sm font-bold text-[#FFD700] hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-4 text-left text-sm font-medium">Product</th>
                <th className="p-4 text-left text-sm font-medium">SKU</th>
                <th className="p-4 text-right text-sm font-medium">Stock</th>
                <th className="p-4 text-right text-sm font-medium">Cost</th>
                <th className="p-4 text-right text-sm font-medium">Price</th>
                <th className="p-4 text-right text-sm font-medium">Margin</th>
                <th className="p-4 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id} className="border-b">
                  {editingId === item.id ? (
                    <>
                      <td className="p-4">
                        <input
                          type="text"
                          value={editForm.name ?? ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          className="w-full rounded border p-1"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={editForm.sku ?? ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, sku: e.target.value })
                          }
                          className="w-full rounded border p-1"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          value={editForm.stock ?? 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              stock: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-20 rounded border p-1 text-right"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          value={editForm.costToMake ?? 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              costToMake: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-20 rounded border p-1 text-right"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          value={editForm.salePrice ?? 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              salePrice: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-20 rounded border p-1 text-right"
                        />
                      </td>
                      <td className="p-4 text-right">-</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={handleSave}
                          className="rounded bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
                        >
                          Save
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 font-medium">{item.name}</td>
                      <td className="p-4 text-gray-500">{item.sku}</td>
                      <td
                        className={`p-4 text-right font-bold ${
                          item.stock <= item.reorderLevel
                            ? "text-red-500"
                            : "text-green-600"
                        }`}
                      >
                        {item.stock}
                      </td>
                      <td className="p-4 text-right">${item.costToMake}</td>
                      <td className="p-4 text-right">${item.salePrice}</td>
                      <td className="p-4 text-right text-green-600">
                        {item.salePrice > 0
                          ? `$${(item.salePrice - item.costToMake).toFixed(2)}`
                          : "-"}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// Orders Tab
function OrdersTab({
  orders,
  setOrders,
  inventory,
  customers,
  setCustomers,
}: {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  inventory: InventoryItem[];
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    date: new Date().toISOString().split("T")[0],
    status: "pending",
    quantity: 1,
  });

  const handleAddOrder = () => {
    if (!newOrder.customer || !newOrder.product) return;

    const product = inventory.find((i) => i.name === newOrder.product);
    const quantity = newOrder.quantity ?? 1;
    const total = (product?.salePrice ?? 0) * quantity;
    const cost = (product?.costToMake ?? 0) * quantity;
    const orderDate = newOrder.date ?? new Date().toISOString().split("T")[0];

    const order: Order = {
      id: Date.now().toString(),
      date: orderDate,
      customer: newOrder.customer ?? "",
      email: newOrder.email ?? "",
      product: newOrder.product ?? "",
      quantity,
      total,
      cost,
      status: newOrder.status ?? "pending",
    };

    setOrders((prev) => [...prev, order]);

    // Update or add customer
    const existingCustomer = customers.find(
      (c) => c.email === newOrder.email || c.name === newOrder.customer
    );
    if (existingCustomer) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === existingCustomer.id
            ? {
                ...c,
                totalOrders: c.totalOrders + 1,
                totalSpent: c.totalSpent + total,
              }
            : c
        )
      );
    } else if (newOrder.email) {
      setCustomers((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          name: newOrder.customer ?? "",
          email: newOrder.email ?? "",
          phone: "",
          totalOrders: 1,
          totalSpent: total,
          notes: "",
        },
      ]);
    }

    setShowForm(false);
    setNewOrder({
      date: new Date().toISOString().split("T")[0],
      status: "pending",
      quantity: 1,
    });
  };

  const handleStatusChange = (orderId: string, status: Order["status"]) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  };

  const handleDelete = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Orders</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded bg-black px-4 py-2 text-sm font-bold text-[#FFD700] hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> Add Order
        </button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <h3 className="mb-4 font-bold">New Order</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={newOrder.date ?? ""}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, date: e.target.value })
                  }
                  className="w-full rounded border p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={newOrder.customer ?? ""}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, customer: e.target.value })
                  }
                  className="w-full rounded border p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={newOrder.email ?? ""}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, email: e.target.value })
                  }
                  className="w-full rounded border p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Product</label>
                <select
                  value={newOrder.product ?? ""}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, product: e.target.value })
                  }
                  className="w-full rounded border p-2"
                >
                  <option value="">Select product...</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name} (${item.salePrice})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={newOrder.quantity ?? 1}
                  onChange={(e) =>
                    setNewOrder({
                      ...newOrder,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full rounded border p-2"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAddOrder}
                className="rounded bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-600"
              >
                Save Order
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded bg-gray-300 px-4 py-2 text-sm font-bold hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-4 text-left text-sm font-medium">Date</th>
                <th className="p-4 text-left text-sm font-medium">Customer</th>
                <th className="p-4 text-left text-sm font-medium">Product</th>
                <th className="p-4 text-right text-sm font-medium">Qty</th>
                <th className="p-4 text-right text-sm font-medium">Total</th>
                <th className="p-4 text-right text-sm font-medium">Profit</th>
                <th className="p-4 text-center text-sm font-medium">Status</th>
                <th className="p-4 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    No orders yet. Add your first order!
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b">
                    <td className="p-4">{order.date}</td>
                    <td className="p-4">
                      <p className="font-medium">{order.customer}</p>
                      <p className="text-xs text-gray-500">{order.email}</p>
                    </td>
                    <td className="p-4">{order.product}</td>
                    <td className="p-4 text-right">{order.quantity}</td>
                    <td className="p-4 text-right font-bold">${order.total}</td>
                    <td className="p-4 text-right text-green-600">
                      ${(order.total - order.cost).toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <select
                        value={order.status}
                        onChange={(e) =>
                          handleStatusChange(
                            order.id,
                            e.target.value as Order["status"]
                          )
                        }
                        className={`rounded border p-1 text-xs font-medium ${
                          order.status === "delivered"
                            ? "bg-green-100 text-green-700"
                            : order.status === "shipped"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// Content Tab
function ContentTab({
  content,
  setContent,
}: {
  content: ContentItem[];
  setContent: React.Dispatch<React.SetStateAction<ContentItem[]>>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newContent, setNewContent] = useState<Partial<ContentItem>>({
    platform: "both",
    type: "video",
    status: "idea",
  });

  const handleAdd = () => {
    const item: ContentItem = {
      id: Date.now().toString(),
      date: newContent.date ?? "",
      platform: newContent.platform ?? "both",
      type: newContent.type ?? "video",
      topic: newContent.topic ?? "",
      product: newContent.product ?? "General",
      status: newContent.status ?? "idea",
      notes: newContent.notes ?? "",
    };
    setContent((prev) => [...prev, item]);
    setShowForm(false);
    setNewContent({ platform: "both", type: "video", status: "idea" });
  };

  const handleStatusChange = (id: string, status: ContentItem["status"]) => {
    setContent((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  };

  const handleDelete = (id: string) => {
    setContent((prev) => prev.filter((item) => item.id !== id));
  };

  const statusColors = {
    idea: "bg-gray-100 text-gray-700",
    planned: "bg-blue-100 text-blue-700",
    created: "bg-yellow-100 text-yellow-700",
    posted: "bg-green-100 text-green-700",
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Content Calendar</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded bg-black px-4 py-2 text-sm font-bold text-[#FFD700] hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> Add Content
        </button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <h3 className="mb-4 font-bold">New Content Idea</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={newContent.date ?? ""}
                  onChange={(e) =>
                    setNewContent({ ...newContent, date: e.target.value })
                  }
                  className="w-full rounded border p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Platform</label>
                <select
                  value={newContent.platform ?? "both"}
                  onChange={(e) =>
                    setNewContent({
                      ...newContent,
                      platform: e.target.value as ContentItem["platform"],
                    })
                  }
                  className="w-full rounded border p-2"
                >
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <select
                  value={newContent.type ?? "video"}
                  onChange={(e) =>
                    setNewContent({
                      ...newContent,
                      type: e.target.value as ContentItem["type"],
                    })
                  }
                  className="w-full rounded border p-2"
                >
                  <option value="video">Video</option>
                  <option value="photo">Photo</option>
                  <option value="reel">Reel</option>
                  <option value="story">Story</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Topic</label>
                <input
                  type="text"
                  value={newContent.topic ?? ""}
                  onChange={(e) =>
                    setNewContent({ ...newContent, topic: e.target.value })
                  }
                  className="w-full rounded border p-2"
                  placeholder="What's this content about?"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Product</label>
                <select
                  value={newContent.product ?? "General"}
                  onChange={(e) =>
                    setNewContent({ ...newContent, product: e.target.value })
                  }
                  className="w-full rounded border p-2"
                >
                  <option value="General">General</option>
                  <option value="Fork Spacers">Fork Spacers</option>
                  <option value="Chain Tensioner">Chain Tensioner</option>
                  <option value="RAM Airbox">RAM Airbox</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea
                  value={newContent.notes ?? ""}
                  onChange={(e) =>
                    setNewContent({ ...newContent, notes: e.target.value })
                  }
                  className="w-full rounded border p-2"
                  rows={2}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAdd}
                className="rounded bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-600"
              >
                Save
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded bg-gray-300 px-4 py-2 text-sm font-bold hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-4 text-left text-sm font-medium">Date</th>
                <th className="p-4 text-left text-sm font-medium">Platform</th>
                <th className="p-4 text-left text-sm font-medium">Type</th>
                <th className="p-4 text-left text-sm font-medium">Topic</th>
                <th className="p-4 text-left text-sm font-medium">Product</th>
                <th className="p-4 text-center text-sm font-medium">Status</th>
                <th className="p-4 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {content.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-4">{item.date || "-"}</td>
                  <td className="p-4 capitalize">{item.platform}</td>
                  <td className="p-4 capitalize">{item.type}</td>
                  <td className="p-4">
                    <p className="font-medium">{item.topic}</p>
                    {item.notes && (
                      <p className="text-xs text-gray-500">{item.notes}</p>
                    )}
                  </td>
                  <td className="p-4">{item.product}</td>
                  <td className="p-4 text-center">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        handleStatusChange(
                          item.id,
                          e.target.value as ContentItem["status"]
                        )
                      }
                      className={`rounded border p-1 text-xs font-medium ${statusColors[item.status]}`}
                    >
                      <option value="idea">Idea</option>
                      <option value="planned">Planned</option>
                      <option value="created">Created</option>
                      <option value="posted">Posted</option>
                    </select>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// Customers Tab
function CustomersTab({
  customers,
  setCustomers,
}: {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({});

  const handleAdd = () => {
    const customer: Customer = {
      id: Date.now().toString(),
      name: newCustomer.name ?? "",
      email: newCustomer.email ?? "",
      phone: newCustomer.phone ?? "",
      totalOrders: 0,
      totalSpent: 0,
      notes: newCustomer.notes ?? "",
    };
    setCustomers((prev) => [...prev, customer]);
    setShowForm(false);
    setNewCustomer({});
  };

  const handleDelete = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Customers</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded bg-black px-4 py-2 text-sm font-bold text-[#FFD700] hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <h3 className="mb-4 font-bold">New Customer</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={newCustomer.name ?? ""}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  className="w-full rounded border p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={newCustomer.email ?? ""}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  className="w-full rounded border p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={newCustomer.phone ?? ""}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  className="w-full rounded border p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <input
                  type="text"
                  value={newCustomer.notes ?? ""}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, notes: e.target.value })
                  }
                  className="w-full rounded border p-2"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAdd}
                className="rounded bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-600"
              >
                Save
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded bg-gray-300 px-4 py-2 text-sm font-bold hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-4 text-left text-sm font-medium">Name</th>
                <th className="p-4 text-left text-sm font-medium">Email</th>
                <th className="p-4 text-left text-sm font-medium">Phone</th>
                <th className="p-4 text-right text-sm font-medium">Orders</th>
                <th className="p-4 text-right text-sm font-medium">
                  Total Spent
                </th>
                <th className="p-4 text-left text-sm font-medium">Notes</th>
                <th className="p-4 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No customers yet. They&apos;ll be added automatically when you
                    create orders, or add them manually.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b">
                    <td className="p-4 font-medium">{customer.name}</td>
                    <td className="p-4">{customer.email}</td>
                    <td className="p-4">{customer.phone || "-"}</td>
                    <td className="p-4 text-right">{customer.totalOrders}</td>
                    <td className="p-4 text-right font-bold">
                      ${customer.totalSpent.toFixed(2)}
                    </td>
                    <td className="p-4 text-gray-500">{customer.notes || "-"}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
