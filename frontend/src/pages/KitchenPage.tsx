import React, { useEffect, useMemo, useState } from "react";
import type { Category, Product, Order, OrderStatus } from "../state/api";
import {
  cancelOrder,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getCategoryWithProducts,
  listCategories,
  listOrders,
  listProducts,
  transitionOrderStatus,
  toggleProductAvailability,
  updateCategory,
  updateProduct,
} from "../state/api";
import { moneyCentsToEuros } from "../state/cart";

function statusLabel(s: OrderStatus) {
  switch (s) {
    case "pending":
      return "En attente";
    case "confirmed":
      return "Confirmée";
    case "preparing":
      return "En préparation";
    case "ready":
      return "Prête";
    case "completed":
      return "Terminée";
    case "cancelled":
      return "Annulée";
  }
}

function statusPillClass(s: OrderStatus) {
  if (s === "completed") return "pillOk";
  if (s === "cancelled") return "pillDanger";
  if (s === "ready") return "pillOk";
  return "";
}

function shortId(id: string) {
  return id.slice(0, 8);
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [categoriesWithProducts, setCategoriesWithProducts] = useState<
    Array<{ category: Category; products: Product[] }>
  >([]);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [newCatName, setNewCatName] = useState("");
  const [newCatDisplayOrder, setNewCatDisplayOrder] = useState("10");

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [editingCatDisplayOrder, setEditingCatDisplayOrder] = useState("10");

  const [newProd, setNewProd] = useState({
    categoryId: "",
    name: "",
    priceEuro: "5.90",
    preparationTimeMin: "5",
    available: true,
  });

  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editingProd, setEditingProd] = useState<{
    id: string;
    categoryId: string;
    name: string;
    priceEuro: string;
    preparationTimeMin: string;
    available: boolean;
  } | null>(null);

  const refreshOrders = async () => {
    setOrdersError(null);
    try {
      const list = await listOrders();
      setOrders(list);
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : "Erreur chargement commandes");
    }
  };

  useEffect(() => {
    refreshOrders();
    const t = window.setInterval(refreshOrders, 2000);
    return () => window.clearInterval(t);
  }, []);

  const refreshMenu = async () => {
    try {
      setMenuError(null);
      const cats = await listCategories();
      const details = await Promise.all(
        cats.map(async (cat) => {
          const d = await getCategoryWithProducts(cat.id);
          return { category: d.category, products: d.products };
        }),
      );
      setCategoriesWithProducts(details);
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : "Erreur chargement menu");
    }
  };

  useEffect(() => {
    refreshMenu();
  }, []);

  const ordersGrouped = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending").sort(sortByEstimated);
    const confirmed = orders.filter((o) => o.status === "confirmed").sort(sortByEstimated);
    const preparing = orders.filter((o) => o.status === "preparing").sort(sortByEstimated);
    const ready = orders.filter((o) => o.status === "ready").sort(sortByEstimated);
    const completed = orders.filter((o) => o.status === "completed").sort(sortByEstimated);
    const cancelled = orders.filter((o) => o.status === "cancelled").sort(sortByEstimated);

    return {
      pending,
      confirmedPreparing: [...confirmed, ...preparing].sort(sortByEstimated),
      ready,
      completed,
      cancelled,
    };
  }, [orders]);

  const allCategories = categoriesWithProducts.map((cp) => cp.category);

  const categoryOptions = allCategories.sort((a, b) => a.displayOrder - b.displayOrder);

  const canTransition = (current: OrderStatus, next: OrderStatus) => {
    const map: Record<OrderStatus, OrderStatus[]> = {
      pending: ["cancelled", "confirmed"],
      confirmed: ["cancelled", "preparing"],
      preparing: ["ready"],
      ready: ["completed"],
      completed: [],
      cancelled: [],
    };
    return map[current]?.includes(next) ?? false;
  };

  return (
    <div className="appShell">
      <div className="topBar">
        <div className="row">
          <div className="brand">Street Bites</div>
          <span className="badge">Mode Cuisine (gérant)</span>
        </div>
        <div className="row">
          <span className="badge">{orders.length} commandes</span>
        </div>
      </div>

      <div className="twoCol">
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="cardHeader">
              <div className="h1">File de commandes</div>
              <span className="muted" style={{ fontSize: 12 }}>
                Polling via `GET /orders`
              </span>
            </div>

            {ordersError ? <div className="pill pillDanger">{ordersError}</div> : null}
            {orders.length === 0 ? <div className="muted">Aucune commande pour le moment.</div> : null}

            {ordersGrouped.pending.length > 0 ? (
              <Section title="En attente (pending)">
                {ordersGrouped.pending.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onCancel={async () => {
                      await cancelOrder({ orderId: o.id });
                      refreshOrders();
                    }}
                    onTransition={async (next) => {
                      await transitionOrderStatus({ orderId: o.id, status: next });
                      refreshOrders();
                    }}
                  />
                ))}
              </Section>
            ) : null}

            {ordersGrouped.confirmedPreparing.length > 0 ? (
              <Section title="Confirmées / préparation (confirmed + preparing)">
                {ordersGrouped.confirmedPreparing.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onCancel={async () => {
                      await cancelOrder({ orderId: o.id });
                      refreshOrders();
                    }}
                    onTransition={async (next) => {
                      await transitionOrderStatus({ orderId: o.id, status: next });
                      refreshOrders();
                    }}
                  />
                ))}
              </Section>
            ) : null}

            {ordersGrouped.ready.length > 0 ? (
              <Section title="Prêtes (ready)">
                {ordersGrouped.ready.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onCancel={async () => {
                      await cancelOrder({ orderId: o.id });
                      refreshOrders();
                    }}
                    onTransition={async (next) => {
                      await transitionOrderStatus({ orderId: o.id, status: next });
                      refreshOrders();
                    }}
                  />
                ))}
              </Section>
            ) : null}

            {ordersGrouped.completed.length > 0 ? (
              <div style={{ marginTop: 18 }}>
                <div className="muted" style={{ fontWeight: 800 }}>
                  Terminées (completed)
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {ordersGrouped.completed.length} commande(s)
                </div>
              </div>
            ) : null}

            {ordersGrouped.cancelled.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div className="muted" style={{ fontWeight: 800 }}>
                  Annulées (cancelled)
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {ordersGrouped.cancelled.length} commande(s)
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <div className="card">
            <div className="cardHeader">
              <div className="h1">Gestion Menu</div>
              <span className="muted" style={{ fontSize: 12 }}>
                CRUD catégories / produits + toggle dispo
              </span>
            </div>

            {menuError ? <div className="pill pillDanger">{menuError}</div> : null}

            <div style={{ display: "grid", gap: 12 }}>
              <div className="card" style={{ padding: 10, background: "transparent" }}>
                <div className="muted" style={{ fontWeight: 800, marginBottom: 8 }}>
                  Nouvelle catégorie
                </div>
                <label>Nom</label>
                <input className="input" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
                <div style={{ marginTop: 8 }}>
                  <label>display_order</label>
                  <input
                    className="input"
                    value={newCatDisplayOrder}
                    onChange={(e) => setNewCatDisplayOrder(e.target.value)}
                  />
                </div>
                <button
                  className="btn btnPrimary"
                  style={{ marginTop: 10, width: "100%" }}
                  onClick={async () => {
                    try {
                      await createCategory({
                        name: newCatName,
                        displayOrder: Number(newCatDisplayOrder),
                      });
                      setNewCatName("");
                      refreshMenu();
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Erreur");
                    }
                  }}
                >
                  Ajouter
                </button>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {categoriesWithProducts.map(({ category: cat, products }) => {
                  const isEditing = editingCatId === cat.id;
                  return (
                    <div key={cat.id} className="card" style={{ padding: 10 }}>
                      <div className="row" style={{ alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          {!isEditing ? (
                            <>
                              <div style={{ fontWeight: 900 }}>{cat.name}</div>
                              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                display_order: {cat.displayOrder} • {products.length} produit(s)
                              </div>
                            </>
                          ) : (
                            <>
                              <label>Nom</label>
                              <input
                                className="input"
                                value={editingCatName}
                                onChange={(e) => setEditingCatName(e.target.value)}
                              />
                              <div style={{ marginTop: 8 }}>
                                <label>display_order</label>
                                <input
                                  className="input"
                                  value={editingCatDisplayOrder}
                                  onChange={(e) => setEditingCatDisplayOrder(e.target.value)}
                                />
                              </div>
                            </>
                          )}
                        </div>

                        <div style={{ display: "grid", gap: 8 }}>
                          {!isEditing ? (
                            <button
                              className="btn"
                              onClick={() => {
                                setEditingCatId(cat.id);
                                setEditingCatName(cat.name);
                                setEditingCatDisplayOrder(String(cat.displayOrder));
                              }}
                            >
                              Modifier
                            </button>
                          ) : (
                            <>
                              <button
                                className="btn btnPrimary"
                                onClick={async () => {
                                  try {
                                    await updateCategory({
                                      id: cat.id,
                                      name: editingCatName,
                                      displayOrder: Number(editingCatDisplayOrder),
                                    });
                                    setEditingCatId(null);
                                    refreshMenu();
                                  } catch (e) {
                                    alert(e instanceof Error ? e.message : "Erreur");
                                  }
                                }}
                              >
                                Enregistrer
                              </button>
                              <button className="btn" onClick={() => setEditingCatId(null)}>
                                Annuler
                              </button>
                            </>
                          )}

                          <button
                            className="btn btnDanger"
                            disabled={products.length > 0}
                            style={{ opacity: products.length > 0 ? 0.55 : 1 }}
                            onClick={async () => {
                              try {
                                await deleteCategory(cat.id);
                                refreshMenu();
                              } catch (e) {
                                alert(e instanceof Error ? e.message : "Erreur");
                              }
                            }}
                            title={products.length > 0 ? "Catégorie non vide" : "Supprimer la catégorie"}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                        {products.map((p) => {
                          const isEditingProd = editingProdId === p.id;
                          return (
                            <div key={p.id} className="card" style={{ padding: 10, background: "rgba(255,255,255,0.03)" }}>
                              <div className="row" style={{ alignItems: "flex-start" }}>
                                <div style={{ flex: 1 }}>
                                  {!isEditingProd ? (
                                    <>
                                      <div style={{ fontWeight: 900 }}>{p.name}</div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                        {moneyCentsToEuros(p.priceCents)} • {p.preparationTimeMin} min
                                      </div>
                                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                        Disponible: <b>{p.available ? "Oui" : "Non"}</b>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <label>Nom</label>
                                      <input
                                        className="input"
                                        value={editingProd?.name ?? ""}
                                        onChange={(e) => setEditingProd((s) => (s ? { ...s, name: e.target.value } : s))}
                                      />
                                      <div style={{ marginTop: 8 }}>
                                        <label>Prix (€)</label>
                                        <input
                                          className="input"
                                          value={editingProd?.priceEuro ?? ""}
                                          onChange={(e) => setEditingProd((s) => (s ? { ...s, priceEuro: e.target.value } : s))}
                                        />
                                      </div>
                                      <div style={{ marginTop: 8 }}>
                                        <label>Temps (min)</label>
                                        <input
                                          className="input"
                                          value={editingProd?.preparationTimeMin ?? ""}
                                          onChange={(e) =>
                                            setEditingProd((s) => (s ? { ...s, preparationTimeMin: e.target.value } : s))
                                          }
                                        />
                                      </div>
                                      <div style={{ marginTop: 8 }}>
                                        <label>Disponible</label>
                                        <select
                                          className="input"
                                          value={editingProd?.available ? "yes" : "no"}
                                          onChange={(e) =>
                                            setEditingProd((s) => (s ? { ...s, available: e.target.value === "yes" } : s))
                                          }
                                        >
                                          <option value="yes">Oui</option>
                                          <option value="no">Non</option>
                                        </select>
                                      </div>
                                    </>
                                  )}
                                </div>

                                <div style={{ display: "grid", gap: 8 }}>
                                  {!isEditingProd ? (
                                    <>
                                      <button
                                        className={`btn ${p.available ? "btnOk" : ""}`}
                                        onClick={async () => {
                                          try {
                                            await toggleProductAvailability({ id: p.id, isAvailable: !p.available });
                                            refreshMenu();
                                          } catch (e) {
                                            alert(e instanceof Error ? e.message : "Erreur");
                                          }
                                        }}
                                      >
                                        {p.available ? "Désactiver" : "Activer"}
                                      </button>
                                      <button
                                        className="btn"
                                        onClick={() => {
                                          setEditingProdId(p.id);
                                          setEditingProd({
                                            id: p.id,
                                            categoryId: p.categoryId,
                                            name: p.name,
                                            priceEuro: (p.priceCents / 100).toFixed(2),
                                            preparationTimeMin: String(p.preparationTimeMin),
                                            available: p.available,
                                          });
                                        }}
                                      >
                                        Modifier
                                      </button>
                                      <button
                                        className="btn btnDanger"
                                        onClick={async () => {
                                          try {
                                            await deleteProduct(p.id);
                                            refreshMenu();
                                          } catch (e) {
                                            alert(e instanceof Error ? e.message : "Erreur");
                                          }
                                        }}
                                      >
                                        Supprimer
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        className="btn btnPrimary"
                                        onClick={async () => {
                                          if (!editingProd) return;
                                          try {
                                            await updateProduct({
                                              id: editingProd.id,
                                              categoryId: editingProd.categoryId,
                                              name: editingProd.name,
                                              priceCents: Math.round(Number(editingProd.priceEuro) * 100),
                                              preparationTimeMin: Number(editingProd.preparationTimeMin),
                                              available: editingProd.available,
                                            });
                                            setEditingProdId(null);
                                            setEditingProd(null);
                                            refreshMenu();
                                          } catch (e) {
                                            alert(e instanceof Error ? e.message : "Erreur");
                                          }
                                        }}
                                      >
                                        Enregistrer
                                      </button>
                                      <button
                                        className="btn"
                                        onClick={() => {
                                          setEditingProdId(null);
                                          setEditingProd(null);
                                        }}
                                      >
                                        Annuler
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        <div className="card" style={{ padding: 10, background: "rgba(255,255,255,0.02)" }}>
                          <div className="muted" style={{ fontWeight: 800, marginBottom: 6 }}>
                            Ajouter un produit ({cat.name})
                          </div>
                          <div style={{ display: "grid", gap: 8 }}>
                            <select
                              className="input"
                              value={newProd.categoryId || cat.id}
                              onChange={(e) => setNewProd((s) => ({ ...s, categoryId: e.target.value }))}
                            >
                              <option value="">(choisir)</option>
                              {categoryOptions.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <input
                              className="input"
                              value={newProd.name}
                              onChange={(e) => setNewProd((s) => ({ ...s, name: e.target.value }))}
                              placeholder="Nom du produit"
                            />
                            <input
                              className="input"
                              value={newProd.priceEuro}
                              onChange={(e) => setNewProd((s) => ({ ...s, priceEuro: e.target.value }))}
                              placeholder="Prix (€)"
                            />
                            <input
                              className="input"
                              value={newProd.preparationTimeMin}
                              onChange={(e) => setNewProd((s) => ({ ...s, preparationTimeMin: e.target.value }))}
                              placeholder="Temps (min)"
                            />
                            <select
                              className="input"
                              value={newProd.available ? "yes" : "no"}
                              onChange={(e) => setNewProd((s) => ({ ...s, available: e.target.value === "yes" }))}
                            >
                              <option value="yes">Disponible</option>
                              <option value="no">Indisponible</option>
                            </select>
                            <button
                              className="btn btnPrimary"
                              onClick={async () => {
                                try {
                                  const categoryId = newProd.categoryId || cat.id;
                                  await createProduct({
                                    categoryId,
                                    name: newProd.name,
                                    priceCents: Math.round(Number(newProd.priceEuro) * 100),
                                    preparationTimeMin: Number(newProd.preparationTimeMin),
                                    available: newProd.available,
                                  });
                                  setNewProd({
                                    categoryId: "",
                                    name: "",
                                    priceEuro: "5.90",
                                    preparationTimeMin: "5",
                                    available: true,
                                  });
                                  refreshMenu();
                                } catch (e) {
                                  alert(e instanceof Error ? e.message : "Erreur");
                                }
                              }}
                            >
                              Ajouter
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function sortByEstimated(a: Order, b: Order) {
  const at = a.estimatedReadyAt ?? a.updatedAt ?? a.createdAt;
  const bt = b.estimatedReadyAt ?? b.updatedAt ?? b.createdAt;
  return at.localeCompare(bt);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="muted" style={{ fontWeight: 800 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{children}</div>
    </div>
  );
}

function OrderCard({
  order,
  onCancel,
  onTransition,
}: {
  order: Order;
  onCancel: () => Promise<void>;
  onTransition: (next: OrderStatus) => Promise<void>;
}) {
  const canCancel = order.status === "pending" || order.status === "confirmed";
  const canConfirm = order.status === "pending";
  const canPreparing = order.status === "confirmed";
  const canReady = order.status === "preparing";
  const canCompleted = order.status === "ready";

  const totalCents = order.items.reduce((sum, i) => sum + i.subtotalCents, 0);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="cardHeader" style={{ marginBottom: 8 }}>
        <div className="h1">#{shortId(order.id)}</div>
        <span className={`pill ${statusPillClass(order.status)}`}>{statusLabel(order.status)}</span>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        Estimée : {order.estimatedReadyAt ? new Date(order.estimatedReadyAt).toLocaleString("fr-FR") : "—"}
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        {order.items.map((it) => (
          <div key={it.productId} className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.productName}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {it.quantity} x • {moneyCentsToEuros(it.unitPriceCents)}
              </div>
            </div>
            <div style={{ fontWeight: 900 }}>{moneyCentsToEuros(it.subtotalCents)}</div>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <div className="muted">Total</div>
        <div className="spacer" />
        <div style={{ fontWeight: 900 }}>{moneyCentsToEuros(totalCents)}</div>
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        {canConfirm ? (
          <button className="btn btnOk" onClick={() => onTransition("confirmed")}>
            Confirmer
          </button>
        ) : null}
        {canPreparing ? (
          <button className="btn btnPrimary" onClick={() => onTransition("preparing")}>
            Passer en préparation
          </button>
        ) : null}
        {canReady ? (
          <button className="btn btnOk" onClick={() => onTransition("ready")}>
            Marquer prête
          </button>
        ) : null}
        {canCompleted ? (
          <button className="btn btnOk" onClick={() => onTransition("completed")}>
            Finaliser
          </button>
        ) : null}
        {canCancel ? (
          <button className="btn btnDanger" onClick={() => onCancel()}>
            Annuler
          </button>
        ) : null}
      </div>
    </div>
  );
}

