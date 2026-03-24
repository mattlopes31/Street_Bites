import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { PrismaClient } from "../prisma/generated";

const prisma = new PrismaClient();

const PORT = Number(process.env.PORT ?? 4002);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Client Service API", version: "1.0.0" },
  },
  apis: ["./src/index.ts"],
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

function toCustomerJson(c: any) {
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    phone: c.phone,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function toHistoryJson(h: any) {
  return {
    id: h.id,
    customerId: h.customer_id,
    orderId: h.order_id,
    totalAmount: h.total_amount.toNumber ? h.total_amount.toNumber() : Number(h.total_amount),
    itemsCount: h.items_count,
    createdAt: h.created_at,
  };
}

function isValidEmail(email: string) {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/**
 * @swagger
 * tags:
 *   - name: Customers
 */

app.get("/customers", async (_req, res) => {
  const customers = await prisma.customer.findMany();
  res.json(customers.map(toCustomerJson));
});

app.get("/customers/:id", async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ message: "Client introuvable." });
  res.json(toCustomerJson(customer));
});

app.post("/customers", async (req, res) => {
  const { name, email, phone } = req.body as { name: string; email: string; phone?: string };
  const trimmedName = String(name ?? "").trim();
  const trimmedEmail = String(email ?? "").trim().toLowerCase();

  if (!trimmedName) return res.status(400).json({ message: "Nom requis." });
  if (!isValidEmail(trimmedEmail)) return res.status(400).json({ message: "Email invalide." });

  const created = await prisma.customer.create({
    data: {
      name: trimmedName,
      email: trimmedEmail,
      phone: phone ? String(phone).trim() : null,
    },
  });

  res.status(201).json(toCustomerJson(created));
});

app.get("/customers/email/:email", async (req, res) => {
  const email = req.params.email.trim().toLowerCase();
  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) return res.status(404).json({ message: "Client introuvable." });
  res.json(toCustomerJson(customer));
});

app.get("/customers/:id/orders", async (req, res) => {
  const customerId = req.params.id;
  const history = await prisma.orderHistory.findMany({
    where: { customer_id: customerId },
    orderBy: { created_at: "desc" },
  });

  res.json(history.map(toHistoryJson));
});

// Called by Order service when order is completed
app.post("/customers/:id/orders", async (req, res) => {
  const customerId = req.params.id;
  const { orderId, totalAmount, itemsCount } = req.body as {
    orderId: string;
    totalAmount: number;
    itemsCount: number;
  };

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return res.status(404).json({ message: "Client introuvable." });

  const created = await prisma.orderHistory.create({
    data: {
      customer_id: customerId,
      order_id: orderId,
      total_amount: Number(totalAmount),
      items_count: Number(itemsCount),
    },
  });

  res.status(201).json(toHistoryJson(created));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[client-service] listening on http://localhost:${PORT}`);
});

