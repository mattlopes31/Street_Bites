import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { PrismaClient } from "../prisma/generated";

const prisma = new PrismaClient();

const PORT = Number(process.env.PORT ?? 4001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "Menu Service API", version: "1.0.0" },
  },
  apis: ["./src/index.ts"],
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

function toCategoryJson(c: any) {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    displayOrder: c.display_order,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function toProductJson(p: any) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price.toNumber ? p.price.toNumber() : Number(p.price),
    categoryId: p.category_id,
    imageUrl: p.image_url,
    isAvailable: p.is_available,
    preparationTime: p.preparation_time,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/**
 * @swagger
 * tags:
 *   - name: Menu
 */

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Liste toutes les catégories
 */
app.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { display_order: "asc" } });
  res.json(categories.map(toCategoryJson));
});

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Détail d'une catégorie avec ses produits
 */
app.get("/categories/:id", async (req, res) => {
  const id = req.params.id;
  const category = await prisma.category.findUnique({
    where: { id },
  });
  if (!category) return res.status(404).json({ message: "Catégorie introuvable." });

  const products = await prisma.product.findMany({
    where: { category_id: id },
  });

  res.json({
    category: toCategoryJson(category),
    products: products.map(toProductJson),
  });
});

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Créer une catégorie
 */
app.post("/categories", async (req, res) => {
  const { name, description, displayOrder } = req.body as {
    name: string;
    description?: string;
    displayOrder?: number;
  };

  const trimmed = String(name ?? "").trim();
  if (!trimmed) return res.status(400).json({ message: "Nom de catégorie requis." });

  const max = await prisma.category.aggregate({ _max: { display_order: true } });
  const nextDisplayOrder: number = Number.isFinite(displayOrder)
    ? Number(displayOrder)
    : Number(max._max.display_order ?? 0) + 10;

  const created = await prisma.category.create({
    data: {
      name: trimmed,
      description: description ? String(description) : null,
      display_order: nextDisplayOrder,
    },
  });

  res.status(201).json(toCategoryJson(created));
});

/**
 * @swagger
 * /categories/{id}:
 *   patch:
 *     summary: Modifier une catégorie
 */
app.patch("/categories/:id", async (req, res) => {
  const id = req.params.id;
  const { name, description, displayOrder } = req.body as {
    name?: string;
    description?: string;
    displayOrder?: number;
  };

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return res.status(404).json({ message: "Catégorie introuvable." });

  const updated = await prisma.category.update({
    where: { id },
    data: {
      name: name ? String(name).trim() : category.name,
      description: description !== undefined ? (description ? String(description) : null) : category.description,
      display_order: displayOrder !== undefined ? Number(displayOrder) : category.display_order,
    },
  });

  res.json(toCategoryJson(updated));
});

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Supprimer une catégorie (si vide)
 */
app.delete("/categories/:id", async (req, res) => {
  const id = req.params.id;
  const count = await prisma.product.count({ where: { category_id: id } });
  if (count > 0) return res.status(400).json({ message: "Suppression impossible : catégorie non vide." });
  await prisma.category.delete({ where: { id } });
  res.status(204).send();
});

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Liste des produits
 */
app.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany();
  res.json(products.map(toProductJson));
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Détail d'un produit
 */
app.get("/products/:id", async (req, res) => {
  const id = req.params.id;
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return res.status(404).json({ message: "Produit introuvable." });
  res.json(toProductJson(p));
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Créer un produit
 */
app.post("/products", async (req, res) => {
  const { categoryId, name, description, price, imageUrl, isAvailable, preparationTime } = req.body as {
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    isAvailable?: boolean;
    preparationTime: number;
  };

  const catId = String(categoryId);
  const trimmed = String(name ?? "").trim();
  const priceNumber = Number(price);
  const prep = Number(preparationTime);

  if (!trimmed) return res.status(400).json({ message: "Nom requis." });
  if (!Number.isFinite(priceNumber) || priceNumber < 0.5) return res.status(400).json({ message: "Prix doit être >= 0,50€." });
  if (!Number.isFinite(prep) || prep < 1 || prep > 60) return res.status(400).json({ message: "Temps de préparation doit être 1..60 min." });

  const created = await prisma.product.create({
    data: {
      category_id: catId,
      name: trimmed,
      description: description ? String(description) : null,
      price: priceNumber,
      image_url: imageUrl ? String(imageUrl) : null,
      is_available: isAvailable ?? true,
      preparation_time: prep,
    },
  });

  res.status(201).json(toProductJson(created));
});

/**
 * @swagger
 * /products/{id}:
 *   patch:
 *     summary: Modifier un produit
 */
app.patch("/products/:id", async (req, res) => {
  const id = req.params.id;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Produit introuvable." });

  const { categoryId, name, description, price, imageUrl, isAvailable, preparationTime } = req.body as Partial<{
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    isAvailable: boolean;
    preparationTime: number;
  }>;

  const nextName = name !== undefined ? String(name).trim() : existing.name;
  const nextPrice = price !== undefined ? Number(price) : existing.price.toNumber();
  const nextPrep = preparationTime !== undefined ? Number(preparationTime) : existing.preparation_time;
  if (!nextName) return res.status(400).json({ message: "Nom requis." });
  if (!Number.isFinite(nextPrice) || nextPrice < 0.5) return res.status(400).json({ message: "Prix doit être >= 0,50€." });
  if (!Number.isFinite(nextPrep) || nextPrep < 1 || nextPrep > 60)
    return res.status(400).json({ message: "Temps de préparation doit être 1..60 min." });

  const updated = await prisma.product.update({
    where: { id },
    data: {
      category_id: categoryId !== undefined ? String(categoryId) : existing.category_id,
      name: nextName,
      description: description !== undefined ? (description ? String(description) : null) : existing.description,
      price: nextPrice,
      image_url: imageUrl !== undefined ? (imageUrl ? String(imageUrl) : null) : existing.image_url,
      is_available: isAvailable !== undefined ? isAvailable : existing.is_available,
      preparation_time: nextPrep,
    },
  });

  res.json(toProductJson(updated));
});

/**
 * @swagger
 * /products/{id}/availability:
 *   patch:
 *     summary: Toggle disponibilité
 */
app.patch("/products/:id/availability", async (req, res) => {
  const id = req.params.id;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Produit introuvable." });

  const { isAvailable } = req.body as { isAvailable?: boolean };
  const toggled = isAvailable !== undefined ? Boolean(isAvailable) : !existing.is_available;

  const updated = await prisma.product.update({
    where: { id },
    data: { is_available: toggled },
  });
  res.json(toProductJson(updated));
});

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Supprimer un produit
 */
app.delete("/products/:id", async (req, res) => {
  const id = req.params.id;
  await prisma.product.delete({ where: { id } });
  res.status(204).send();
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[menu-service] listening on http://localhost:${PORT}`);
});

