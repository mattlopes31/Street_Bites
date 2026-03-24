import type { CartLine } from "./cart";

const MENU_BASE = import.meta.env.VITE_MENU_SERVICE_URL ?? "http://localhost:4001";
const CLIENT_BASE = import.meta.env.VITE_CLIENT_SERVICE_URL ?? "http://localhost:4002";
const ORDER_BASE = import.meta.env.VITE_ORDER_SERVICE_URL ?? "http://localhost:4003";

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
};

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  priceCents: number;
  imageUrl?: string | null;
  available: boolean;
  preparationTimeMin: number;
};

export type Customer = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
};

export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

export type OrderItem = {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
};

export type Order = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  estimatedReadyAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  items: OrderItem[];
};

export type CustomerOrderHistory = {
  orderId: string;
  totalAmountCents: number;
  itemsCount: number;
  createdAt: string;
};

function eurosToCents(euros: number) {
  return Math.round(euros * 100);
}

function assertOk(resp: Response, context: string) {
  if (resp.ok) return;
  throw new Error(`${context} - HTTP ${resp.status} ${resp.statusText}`);
}

async function fetchJson<T>(url: string, init?: RequestInit, context = "API") {
  const resp = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  assertOk(resp, context);
  return (await resp.json()) as T;
}

function mapCategory(api: any): Category {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? null,
    displayOrder: Number(api.displayOrder),
  };
}

function mapProduct(api: any): Product {
  return {
    id: api.id,
    categoryId: api.categoryId ?? api.category_id,
    name: api.name,
    description: api.description ?? null,
    priceCents: eurosToCents(Number(api.price)),
    imageUrl: api.imageUrl ?? api.image_url ?? null,
    available: Boolean(api.isAvailable ?? api.is_available),
    preparationTimeMin: Number(api.preparationTime ?? api.preparation_time),
  };
}

function mapOrderItem(api: any): OrderItem {
  return {
    productId: api.productId ?? api.product_id,
    productName: api.productName ?? api.product_name,
    unitPriceCents: eurosToCents(Number(api.unitPrice ?? api.unit_price)),
    quantity: Number(api.quantity),
    subtotalCents: eurosToCents(Number(api.subtotal ?? api.subtotal)),
  };
}

function mapOrder(api: any): Order {
  const items = Array.isArray(api.items) ? api.items.map(mapOrderItem) : [];
  return {
    id: api.id,
    customerId: api.customerId ?? api.customer_id,
    customerName: api.customerName ?? api.customer_name,
    customerEmail: api.customerEmail ?? api.customer_email,
    status: api.status as OrderStatus,
    estimatedReadyAt: api.estimatedReadyAt ?? api.estimated_ready_at ?? null,
    createdAt: api.createdAt ?? api.created_at,
    updatedAt: api.updatedAt ?? api.updated_at ?? null,
    items,
  };
}

// Menu Service
export async function listCategories(): Promise<Category[]> {
  const api = await fetchJson<any[]>(`${MENU_BASE}/categories`, undefined, "MenuService GET /categories");
  return api.map(mapCategory);
}

export async function getCategoryWithProducts(categoryId: string): Promise<{
  category: Category;
  products: Product[];
}> {
  const api = await fetchJson<any>(`${MENU_BASE}/categories/${encodeURIComponent(categoryId)}`, undefined, "MenuService GET /categories/:id");
  return {
    category: mapCategory(api.category),
    products: (api.products ?? []).map(mapProduct),
  };
}

export async function listProducts(): Promise<Product[]> {
  const api = await fetchJson<any[]>(`${MENU_BASE}/products`, undefined, "MenuService GET /products");
  return api.map(mapProduct);
}

export async function createCategory(input: { name: string; description?: string; displayOrder?: number }) {
  const body = {
    name: input.name,
    description: input.description,
    displayOrder: input.displayOrder,
  };
  const api = await fetchJson<any>(`${MENU_BASE}/categories`, { method: "POST", body: JSON.stringify(body) }, "MenuService POST /categories");
  return mapCategory(api);
}

export async function updateCategory(input: { id: string; name: string; description?: string; displayOrder?: number }) {
  const body = {
    name: input.name,
    description: input.description,
    displayOrder: input.displayOrder,
  };
  const api = await fetchJson<any>(`${MENU_BASE}/categories/${encodeURIComponent(input.id)}`, { method: "PATCH", body: JSON.stringify(body) }, "MenuService PATCH /categories/:id");
  return mapCategory(api);
}

export async function deleteCategory(categoryId: string) {
  const resp = await fetch(`${MENU_BASE}/categories/${encodeURIComponent(categoryId)}`, { method: "DELETE" });
  assertOk(resp, "MenuService DELETE /categories/:id");
}

export async function createProduct(input: {
  categoryId: string;
  name: string;
  description?: string;
  priceCents: number;
  imageUrl?: string;
  available: boolean;
  preparationTimeMin: number;
}) {
  const body = {
    categoryId: input.categoryId,
    name: input.name,
    description: input.description,
    price: input.priceCents / 100,
    imageUrl: input.imageUrl,
    isAvailable: input.available,
    preparationTime: input.preparationTimeMin,
  };
  const api = await fetchJson<any>(`${MENU_BASE}/products`, { method: "POST", body: JSON.stringify(body) }, "MenuService POST /products");
  return mapProduct(api);
}

export async function updateProduct(input: {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  priceCents: number;
  imageUrl?: string;
  available: boolean;
  preparationTimeMin: number;
}) {
  const body = {
    categoryId: input.categoryId,
    name: input.name,
    description: input.description,
    price: input.priceCents / 100,
    imageUrl: input.imageUrl,
    isAvailable: input.available,
    preparationTime: input.preparationTimeMin,
  };
  const api = await fetchJson<any>(`${MENU_BASE}/products/${encodeURIComponent(input.id)}`, { method: "PATCH", body: JSON.stringify(body) }, "MenuService PATCH /products/:id");
  return mapProduct(api);
}

export async function toggleProductAvailability(input: { id: string; isAvailable: boolean }) {
  const body = { isAvailable: input.isAvailable };
  const api = await fetchJson<any>(`${MENU_BASE}/products/${encodeURIComponent(input.id)}/availability`, { method: "PATCH", body: JSON.stringify(body) }, "MenuService PATCH /products/:id/availability");
  return mapProduct(api);
}

export async function deleteProduct(productId: string) {
  const resp = await fetch(`${MENU_BASE}/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
  assertOk(resp, "MenuService DELETE /products/:id");
}

// Client Service
export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  try {
    const api = await fetchJson<any>(`${CLIENT_BASE}/customers/email/${encodeURIComponent(email)}`);
    return api ? (api as Customer) : null;
  } catch {
    return null;
  }
}

export async function getCustomerOrders(customerId: string): Promise<CustomerOrderHistory[]> {
  const api = await fetchJson<any[]>(`${CLIENT_BASE}/customers/${encodeURIComponent(customerId)}/orders`, undefined, "ClientService GET /customers/:id/orders");
  return api.map((h) => ({
    orderId: h.orderId ?? h.order_id,
    totalAmountCents: eurosToCents(Number(h.totalAmount ?? h.total_amount)),
    itemsCount: Number(h.itemsCount ?? h.items_count),
    createdAt: h.createdAt ?? h.created_at,
  }));
}

// Order Service
export async function createOrder(input: { customer: { name: string; email: string; phone?: string }; items: CartLine[] }): Promise<Order> {
  const body = {
    customer: {
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
    },
    items: input.items.map((l) => ({ productId: l.productId, quantity: l.quantity })),
  };
  const api = await fetchJson<any>(`${ORDER_BASE}/orders`, { method: "POST", body: JSON.stringify(body) }, "OrderService POST /orders");
  return mapOrder(api);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  try {
    const api = await fetchJson<any>(`${ORDER_BASE}/orders/${encodeURIComponent(orderId)}`, undefined, "OrderService GET /orders/:id");
    return mapOrder(api);
  } catch {
    return null;
  }
}

export async function listOrders(): Promise<Order[]> {
  const api = await fetchJson<any[]>(`${ORDER_BASE}/orders`, undefined, "OrderService GET /orders");
  return api.map(mapOrder);
}

export async function listOrdersQueue(): Promise<Order[]> {
  const api = await fetchJson<any[]>(`${ORDER_BASE}/orders/queue`, undefined, "OrderService GET /orders/queue");
  return api.map(mapOrder);
}

export async function transitionOrderStatus(input: { orderId: string; status: OrderStatus }): Promise<Order> {
  const body = { status: input.status };
  const api = await fetchJson<any>(
    `${ORDER_BASE}/orders/${encodeURIComponent(input.orderId)}/status`,
    { method: "PATCH", body: JSON.stringify(body) },
    "OrderService PATCH /orders/:id/status",
  );
  return mapOrder(api);
}

export async function cancelOrder(input: { orderId: string }): Promise<Order> {
  const api = await fetchJson<any>(
    `${ORDER_BASE}/orders/${encodeURIComponent(input.orderId)}/cancel`,
    { method: "POST" },
    "OrderService POST /orders/:id/cancel",
  );
  return mapOrder(api);
}

