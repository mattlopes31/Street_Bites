import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { PrismaClient } from "../prisma/generated";

const prisma = new PrismaClient();

const PORT = Number(process.env.PORT ?? 4003);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const MENU_SERVICE_URL = process.env.MENU_SERVICE_URL ?? "http://localhost:4001";
const CLIENT_SERVICE_URL = process.env.CLIENT_SERVICE_URL ?? "http://localhost:4002";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Order Service API", version: "1.0.0" },
  },
  apis: ["./src/index.ts"],
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

type CustomerInput = { name: string; email: string; phone?: string };
type CreateOrderInput = { customer: CustomerInput; items: { productId: string; quantity: number }[] };

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 5000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: ctrl.signal, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${txt}`);
    }
    return (await resp.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function toOrderStatus(s: string): OrderStatus {
  const ok: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
  if (!ok.includes(s as OrderStatus)) throw new Error("Statut invalide.");
  return s as OrderStatus;
}

function allowedTransitions(current: OrderStatus): OrderStatus[] {
  const map: Record<OrderStatus, OrderStatus[]> = {
    pending: ["cancelled", "confirmed"],
    confirmed: ["cancelled", "preparing"],
    preparing: ["ready"],
    ready: ["completed"],
    completed: [],
    cancelled: [],
  };
  return map[current] ?? [];
}

function statusTitle(s: OrderStatus) {
  return s;
}

function toOrderJson(o: any, items?: any[]) {
  return {
    id: o.id,
    customerId: o.customer_id,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    status: o.status,
    discountAmount: o.discount_amount.toNumber ? o.discount_amount.toNumber() : Number(o.discount_amount),
    estimatedReadyAt: o.estimated_ready_at,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    items: (items ?? o.items ?? []).map((it: any) => ({
      id: it.id,
      productId: it.product_id,
      productName: it.product_name,
      unitPrice: it.unit_price.toNumber ? it.unit_price.toNumber() : Number(it.unit_price),
      quantity: it.quantity,
      subtotal: it.subtotal.toNumber ? it.subtotal.toNumber() : Number(it.subtotal),
    })),
  };
}

function isValidEmail(email: string) {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function upsertCustomer(input: CustomerInput): Promise<{ id: string; name: string; email: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const phone = input.phone?.trim() ? input.phone.trim() : undefined;
  if (!isValidEmail(email)) throw new Error("Email invalide.");
  if (!name) throw new Error("Nom requis.");

  try {
    const existing = await fetchJson<{ id: string; name: string; email: string }>(
      `${CLIENT_SERVICE_URL}/customers/email/${encodeURIComponent(email)}`,
    );
    return { id: existing.id, name: existing.name, email: existing.email };
  } catch (e) {
    // If GET fails, create
  }

  const created = await fetchJson<{ id: string; name: string; email: string }>(`${CLIENT_SERVICE_URL}/customers`, {
    method: "POST",
    body: JSON.stringify({ name, email, phone }),
  });
  return { id: created.id, name: created.name, email: created.email };
}

async function getMenuProduct(productId: string): Promise<{
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  preparationTime: number;
}> {
  const p = await fetchJson<any>(`${MENU_SERVICE_URL}/products/${encodeURIComponent(productId)}`);
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    isAvailable: Boolean(p.isAvailable),
    preparationTime: Number(p.preparationTime),
  };
}

app.get("/orders", async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { created_at: "desc" },
    include: { items: true },
  });
  res.json(orders.map((o) => toOrderJson(o)));
});

app.get("/orders/:id", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: "Commande introuvable." });
  res.json(toOrderJson(order));
});

app.get("/orders/queue", async (_req, res) => {
  const orders = await prisma.order.findMany({
    where: { status: { in: ["confirmed", "preparing", "ready"] } },
    include: { items: true },
    orderBy: { estimated_ready_at: "asc" },
  });
  res.json(orders.filter((o) => o.status === "confirmed" || o.status === "preparing").map((o) => toOrderJson(o)));
});

app.get("/orders/customer/:customerId", async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { customer_id: req.params.customerId },
    include: { items: true },
    orderBy: { created_at: "desc" },
  });
  res.json(orders.map((o) => toOrderJson(o)));
});

app.post("/orders", async (req, res) => {
  const input = req.body as CreateOrderInput;
  if (!input?.customer) return res.status(400).json({ message: "customer requis." });
  if (!Array.isArray(input.items) || input.items.length < 1) return res.status(400).json({ message: "items requis." });

  // Validate items
  const itemsNormalized = input.items
    .map((it) => ({
      productId: String(it.productId),
      quantity: Math.floor(Number(it.quantity)),
    }))
    .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity >= 1);

  if (itemsNormalized.length < 1) return res.status(400).json({ message: "Une commande doit contenir au moins 1 article." });

  // Customer
  let customer: { id: string; name: string; email: string };
  try {
    customer = await upsertCustomer(input.customer);
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Client invalide." });
  }

  // Products
  const menuProducts = await Promise.all(itemsNormalized.map((it) => getMenuProduct(it.productId)));
  menuProducts.forEach((p, idx) => {
    if (!p) return;
    if (!p.isAvailable) throw new Error(`Produit indisponible: ${p.name}`);
    const prep = Number(p.preparationTime);
    if (!Number.isFinite(prep) || prep < 1 || prep > 60) throw new Error("Temps préparation invalide.");
    const qty = itemsNormalized[idx]?.quantity ?? 0;
    if (qty < 1) throw new Error("Quantité invalide.");
  });

  const maxPrep = Math.max(...menuProducts.map((p) => p.preparationTime));
  const estimatedReadyAt = new Date(Date.now() + (maxPrep + 5) * 60_000);

  // Persist
  const created = await prisma.order.create({
    data: {
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: customer.email,
      status: "pending",
      discount_amount: 0,
      estimated_ready_at: estimatedReadyAt,
      items: {
        create: menuProducts.map((p, i) => {
          const qty = itemsNormalized[i].quantity;
          const unitPrice = p.price;
          const subtotal = unitPrice * qty;
          return {
            product_id: p.id,
            product_name: p.name,
            unit_price: unitPrice,
            quantity: qty,
            subtotal,
          };
        }),
      },
    },
    include: { items: true },
  });

  res.status(201).json(toOrderJson(created));
});

app.patch("/orders/:id/status", async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body as { status: string };
  if (!status) return res.status(400).json({ message: "status requis." });
  const nextStatus = toOrderStatus(status);

  const existing = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!existing) return res.status(404).json({ message: "Commande introuvable." });
  const current = existing.status as OrderStatus;

  const allowed = allowedTransitions(current);
  if (!allowed.includes(nextStatus)) {
    return res.status(400).json({ message: `Transition impossible : ${current} -> ${nextStatus}` });
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: nextStatus,
      updated_at: new Date(),
    },
    include: { items: true },
  });

  // When completed, store history
  if (nextStatus === "completed") {
    const totalAmount = (updated.items ?? []).reduce((sum, it: any) => {
      const sub = it.subtotal.toNumber ? it.subtotal.toNumber() : Number(it.subtotal);
      return sum + sub;
    }, 0);
    const itemsCount = (updated.items ?? []).reduce((sum, it: any) => sum + Number(it.quantity), 0);

    try {
      await fetchJson(
        `${CLIENT_SERVICE_URL}/customers/${encodeURIComponent(updated.customer_id)}/orders`,
        {
          method: "POST",
          body: JSON.stringify({ orderId: updated.id, totalAmount, itemsCount }),
        },
      );
    } catch (e) {
      // If history insert fails, we still return order status
    }
  }

  res.json(toOrderJson(updated));
});

app.post("/orders/:id/cancel", async (req, res) => {
  const orderId = req.params.id;
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return res.status(404).json({ message: "Commande introuvable." });

  const current = existing.status as OrderStatus;
  if (!(current === "pending" || current === "confirmed")) {
    return res.status(400).json({ message: "Annulation impossible pour ce statut." });
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: "cancelled", updated_at: new Date() },
    include: { items: true },
  });

  res.json(toOrderJson(updated));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[order-service] listening on http://localhost:${PORT}`);
});

