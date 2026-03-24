import { useEffect, useState } from "react";

export type Id = string;

export type Category = {
  id: Id;
  name: string;
  displayOrder: number;
};

export type Product = {
  id: Id;
  categoryId: Id;
  name: string;
  priceCents: number; // integer cents
  preparationTimeMin: number; // 1..60
  available: boolean;
  displayOrder: number;
};

export type Customer = {
  id: Id;
  name: string;
  email: string;
  phone?: string;
  createdAt: string; // ISO
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type OrderItem = {
  productId: Id;
  quantity: number;
  unitPriceCents: number;
  productName: string;
  preparationTimeMin: number;
};

export type Order = {
  id: Id;
  customerId: Id;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
  estimatedReadyAt?: string; // ISO
  cancelledAt?: string; // ISO
};

export type CartLine = { productId: Id; quantity: number };
export type Cart = { lines: CartLine[] };

export type StreetBitesDB = {
  version: number;
  categories: Category[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  counters: {
    nextCategoryDisplayOrder: number;
  };
};

const DB_KEY = "street-bites:db:v1";
const CART_KEY = "street-bites:cart:v1";
const CHANNEL = "street-bites:sync:v1";

function nowIso() {
  return new Date().toISOString();
}

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function uuid(): Id {
  // Prefer crypto UUID if available
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function moneyCentsToEuros(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export const ui = { moneyCentsToEuros };

function initDb(): StreetBitesDB {
  const cat1: Category = { id: uuid(), name: "Burgers", displayOrder: 10 };
  const cat2: Category = { id: uuid(), name: "Tacos", displayOrder: 20 };
  const cat3: Category = { id: uuid(), name: "Desserts", displayOrder: 30 };

  const p1: Product = {
    id: uuid(),
    categoryId: cat1.id,
    name: "Classic Burger",
    priceCents: 1250,
    preparationTimeMin: 8,
    available: true,
    displayOrder: 10,
  };
  const p2: Product = {
    id: uuid(),
    categoryId: cat1.id,
    name: "Cheese Burger",
    priceCents: 1390,
    preparationTimeMin: 10,
    available: true,
    displayOrder: 20,
  };
  const p3: Product = {
    id: uuid(),
    categoryId: cat2.id,
    name: "Chicken Tacos",
    priceCents: 1090,
    preparationTimeMin: 6,
    available: true,
    displayOrder: 10,
  };
  const p4: Product = {
    id: uuid(),
    categoryId: cat2.id,
    name: "Beef Tacos",
    priceCents: 1190,
    preparationTimeMin: 7,
    available: true,
    displayOrder: 20,
  };
  const p5: Product = {
    id: uuid(),
    categoryId: cat3.id,
    name: "Brownie",
    priceCents: 590,
    preparationTimeMin: 3,
    available: true,
    displayOrder: 10,
  };

  return {
    version: 1,
    categories: [cat1, cat2, cat3].sort((a, b) => a.displayOrder - b.displayOrder),
    products: [p1, p2, p3, p4, p5].sort((a, b) => a.displayOrder - b.displayOrder),
    customers: [],
    orders: [],
    counters: {
      nextCategoryDisplayOrder: 40,
    },
  };
}

export function readDb(): StreetBitesDB {
  const parsed = safeParseJson<StreetBitesDB>(localStorage.getItem(DB_KEY));
  if (!parsed) {
    const fresh = initDb();
    localStorage.setItem(DB_KEY, JSON.stringify(fresh));
    return fresh;
  }
  return parsed;
}

function writeDb(db: StreetBitesDB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function broadcastDbUpdate() {
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ type: "db-updated", at: nowIso() });
    ch.close();
  } catch {
    // ignore
  }
}

export function updateDb(mutator: (draft: StreetBitesDB) => StreetBitesDB) {
  const current = readDb();
  const next = mutator(current);
  next.version = (current.version ?? 0) + 1;
  writeDb(next);
  broadcastDbUpdate();
  return next;
}

export function useStreetBitesDb() {
  const [db, setDb] = useState<StreetBitesDB>(() => readDb());

  useEffect(() => {
    let mounted = true;

    const sync = () => {
      if (!mounted) return;
      setDb(readDb());
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === DB_KEY) sync();
    };

    window.addEventListener("storage", onStorage);

    // Faster than storage event between same-origin tabs
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (ev) => {
        if ((ev.data as any)?.type === "db-updated") sync();
      };
    } catch {
      // ignore
    }

    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
      bc?.close();
    };
  }, []);

  return db;
}

export function getCart(): Cart {
  const parsed = safeParseJson<Cart>(localStorage.getItem(CART_KEY));
  return parsed ?? { lines: [] };
}

export function setCart(cart: Cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function addToCart(productId: Id, quantityDelta: number) {
  const cart = getCart();
  const existing = cart.lines.find((l) => l.productId === productId);
  if (existing) {
    existing.quantity = Math.max(0, existing.quantity + quantityDelta);
    cart.lines = cart.lines.filter((l) => l.quantity > 0);
  } else if (quantityDelta > 0) {
    cart.lines.push({ productId, quantity: quantityDelta });
  }
  setCart(cart);
  return cart;
}

export function setCartQuantity(productId: Id, quantity: number) {
  const cart = getCart();
  const q = Math.max(0, Math.floor(quantity));
  cart.lines = cart.lines
    .map((l) => (l.productId === productId ? { ...l, quantity: q } : l))
    .filter((l) => l.quantity > 0);
  setCart(cart);
  return cart;
}

export function clearCart() {
  const next: Cart = { lines: [] };
  setCart(next);
  return next;
}

export function resetLocalState() {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(CART_KEY);
}

export function findCustomerByEmail(email: string) {
  const db = readDb();
  const normalized = email.trim().toLowerCase();
  return db.customers.find((c) => c.email.toLowerCase() === normalized) ?? null;
}

export function upsertCustomer(input: {
  name: string;
  email: string;
  phone?: string;
}): Customer {
  const db = readDb();
  const normalized = input.email.trim().toLowerCase();
  const existing = db.customers.find((c) => c.email.toLowerCase() === normalized);
  if (existing) return existing;

  const customer: Customer = {
    id: uuid(),
    name: input.name.trim(),
    email: normalized,
    phone: input.phone?.trim() ? input.phone.trim() : undefined,
    createdAt: nowIso(),
  };

  updateDb((draft) => ({ ...draft, customers: [...draft.customers, customer] }));
  return customer;
}

function computeEstimatedReadyAt(maxPrepMinutes: number) {
  const baseMs = maxPrepMinutes * 60_000;
  const readyAfterMs = baseMs + 5 * 60_000;
  return new Date(Date.now() + readyAfterMs).toISOString();
}

export function createOrder(input: { email: string; name: string; phone?: string }): Order {
  const cart = getCart();
  const db = readDb();
  const customer = upsertCustomer({
    email: input.email,
    name: input.name,
    phone: input.phone,
  });

  const items: OrderItem[] = cart.lines
    .map((line) => {
      const product = db.products.find((p) => p.id === line.productId);
      if (!product) return null;
      if (!product.available) return null;
      if (!Number.isFinite(line.quantity) || line.quantity < 1) return null;

      return {
        productId: product.id,
        quantity: Math.floor(line.quantity),
        unitPriceCents: product.priceCents,
        productName: product.name,
        preparationTimeMin: product.preparationTimeMin,
      } satisfies OrderItem;
    })
    .filter(Boolean) as OrderItem[];

  if (items.length < 1) {
    throw new Error("Votre panier ne contient aucun article disponible.");
  }

  const maxPrep = Math.max(...items.map((i) => i.preparationTimeMin));
  const estimatedReadyAt = computeEstimatedReadyAt(maxPrep);

  const order: Order = {
    id: uuid(),
    customerId: customer.id,
    status: "pending",
    items,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    estimatedReadyAt,
  };

  updateDb((draft) => ({ ...draft, orders: [order, ...draft.orders] }));
  clearCart();
  return order;
}

export function getOrderById(orderId: Id) {
  const db = readDb();
  return db.orders.find((o) => o.id === orderId) ?? null;
}

export function listOrders() {
  const db = readDb();
  return [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listOrdersByStatus(statuses: OrderStatus[]) {
  const db = readDb();
  const set = new Set(statuses);
  return [...db.orders]
    .filter((o) => set.has(o.status))
    .sort((a, b) => {
      const at = a.estimatedReadyAt ?? a.updatedAt;
      const bt = b.estimatedReadyAt ?? b.updatedAt;
      return at.localeCompare(bt);
    });
}

export function getCustomerOrders(customerId: Id) {
  const db = readDb();
  return db.orders
    .filter((o) => o.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function canTransition(current: OrderStatus, next: OrderStatus) {
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    pending: ["cancelled", "confirmed"],
    confirmed: ["cancelled", "preparing"],
    preparing: ["ready"],
    ready: ["completed"],
    completed: [],
    cancelled: [],
  };
  return allowed[current]?.includes(next) ?? false;
}

export function transitionOrder(orderId: Id, nextStatus: OrderStatus) {
  const currentDb = readDb();
  const order = currentDb.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Commande introuvable.");
  if (!canTransition(order.status, nextStatus)) {
    throw new Error(`Transition impossible : ${order.status} -> ${nextStatus}`);
  }

  return updateDb((draft) => {
    const updatedOrders = draft.orders.map((o) => {
      if (o.id !== orderId) return o;
      const patch: Partial<Order> = {
        status: nextStatus,
        updatedAt: nowIso(),
      };
      if (nextStatus === "cancelled") patch.cancelledAt = nowIso();
      return { ...o, ...patch };
    });
    return { ...draft, orders: updatedOrders };
  });
}

export function cancelOrder(orderId: Id) {
  const order = getOrderById(orderId);
  if (!order) throw new Error("Commande introuvable.");
  if (!(order.status === "pending" || order.status === "confirmed")) {
    throw new Error("Annulation impossible pour ce statut.");
  }
  return transitionOrder(orderId, "cancelled");
}

export function getProductsByCategory(categoryId: Id) {
  const db = readDb();
  return db.products
    .filter((p) => p.categoryId === categoryId)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function toggleProductAvailability(productId: Id) {
  return updateDb((draft) => {
    const nextProducts = draft.products.map((p) =>
      p.id === productId ? { ...p, available: !p.available } : p,
    );
    return { ...draft, products: nextProducts };
  });
}

export function createCategory(input: { name: string; displayOrder?: number }) {
  const name = input.name.trim();
  if (!name) throw new Error("Nom de catégorie requis.");

  return updateDb((draft) => {
    const displayOrder =
      input.displayOrder ?? draft.counters.nextCategoryDisplayOrder ?? 0;
    const cat: Category = {
      id: uuid(),
      name,
      displayOrder,
    };
    return {
      ...draft,
      categories: [...draft.categories, cat].sort((a, b) => a.displayOrder - b.displayOrder),
      counters: {
        ...draft.counters,
        nextCategoryDisplayOrder: Math.max(displayOrder + 10, draft.counters.nextCategoryDisplayOrder),
      },
    };
  });
}

export function updateCategory(input: { id: Id; name: string; displayOrder: number }) {
  const name = input.name.trim();
  if (!name) throw new Error("Nom de catégorie requis.");
  const displayOrder = Number(input.displayOrder);
  if (!Number.isFinite(displayOrder)) throw new Error("displayOrder invalide.");

  return updateDb((draft) => {
    const categories = draft.categories.map((c) =>
      c.id === input.id ? { ...c, name, displayOrder } : c,
    );
    return { ...draft, categories: categories.sort((a, b) => a.displayOrder - b.displayOrder) };
  });
}

export function deleteCategory(categoryId: Id) {
  const db = readDb();
  const hasProducts = db.products.some((p) => p.categoryId === categoryId);
  if (hasProducts) throw new Error("Suppression impossible : catégorie non vide.");
  return updateDb((draft) => ({
    ...draft,
    categories: draft.categories.filter((c) => c.id !== categoryId),
  }));
}

export function createProduct(input: {
  categoryId: Id;
  name: string;
  priceCents: number;
  preparationTimeMin: number;
  available: boolean;
  displayOrder?: number;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Nom de produit requis.");
  const priceCents = Math.round(Number(input.priceCents));
  if (!Number.isFinite(priceCents) || priceCents < 50) {
    throw new Error("Le prix doit être >= 0,50€.");
  }
  const preparationTimeMin = Math.round(Number(input.preparationTimeMin));
  if (!Number.isFinite(preparationTimeMin) || preparationTimeMin < 1 || preparationTimeMin > 60) {
    throw new Error("Le temps de préparation doit être entre 1 et 60 minutes.");
  }

  return updateDb((draft) => {
    const sameCatProducts = draft.products.filter((p) => p.categoryId === input.categoryId);
    const maxOrder = sameCatProducts.reduce((m, p) => Math.max(m, p.displayOrder), 0);
    const displayOrder = input.displayOrder ?? maxOrder + 10;
    const product: Product = {
      id: uuid(),
      categoryId: input.categoryId,
      name,
      priceCents,
      preparationTimeMin,
      available: !!input.available,
      displayOrder,
    };

    return {
      ...draft,
      products: [...draft.products, product].sort((a, b) => a.displayOrder - b.displayOrder),
    };
  });
}

export function updateProduct(input: {
  id: Id;
  categoryId: Id;
  name: string;
  priceCents: number;
  preparationTimeMin: number;
  available: boolean;
  displayOrder?: number;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Nom de produit requis.");
  const priceCents = Math.round(Number(input.priceCents));
  const preparationTimeMin = Math.round(Number(input.preparationTimeMin));
  if (!Number.isFinite(priceCents) || priceCents < 50) throw new Error("Prix invalide.");
  if (!Number.isFinite(preparationTimeMin) || preparationTimeMin < 1 || preparationTimeMin > 60) {
    throw new Error("Temps invalide.");
  }

  return updateDb((draft) => {
    const products = draft.products.map((p) => {
      if (p.id !== input.id) return p;
      return {
        ...p,
        categoryId: input.categoryId,
        name,
        priceCents,
        preparationTimeMin,
        available: !!input.available,
        displayOrder: input.displayOrder ?? p.displayOrder,
      };
    });
    return { ...draft, products: products.sort((a, b) => a.displayOrder - b.displayOrder) };
  });
}

export function deleteProduct(productId: Id) {
  return updateDb((draft) => ({
    ...draft,
    products: draft.products.filter((p) => p.id !== productId),
  }));
}

