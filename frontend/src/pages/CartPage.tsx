import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createOrder,
  findCustomerByEmail,
  getCustomerOrders,
  listProducts,
  type CustomerOrderHistory,
  type Product,
} from "../state/api";
import { clearCart, getCart, moneyCentsToEuros, setCartQuantity, useCart } from "../state/cart";

function safeEmailLooksValid(email: string) {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function CartPage() {
  const navigate = useNavigate();
  const { cart, setCartState, cartCount } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);

  const [customer, setCustomer] = useState<{ id: string; name: string; email: string } | null>(null);
  const [customerHistory, setCustomerHistory] = useState<CustomerOrderHistory[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingProducts(true);
        setProductsError(null);
        const list = await listProducts();
        if (!cancelled) setProducts(list);
      } catch (e) {
        if (!cancelled) setProductsError(e instanceof Error ? e.message : "Erreur chargement produits");
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  useEffect(() => {
    const email = form.email.trim();
    if (!safeEmailLooksValid(email)) {
      setCustomer(null);
      setCustomerHistory([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const c = await findCustomerByEmail(email);
        if (cancelled) return;
        setCustomer(c ? { id: c.id, name: c.name, email: c.email } : null);
        if (c) setCustomerHistory(await getCustomerOrders(c.id));
        else setCustomerHistory([]);
      } catch {
        if (!cancelled) {
          setCustomer(null);
          setCustomerHistory([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.email]);

  const totalCents = useMemo(() => {
    return cart.lines.reduce((sum, l) => {
      const p = productsById.get(l.productId);
      if (!p) return sum;
      return sum + p.priceCents * l.quantity;
    }, 0);
  }, [cart.lines, productsById]);

  const cartLines = useMemo(() => {
    return cart.lines
      .map((l) => {
        const product = productsById.get(l.productId);
        if (!product) return null;
        return { line: l, product };
      })
      .filter(Boolean) as { line: { productId: string; quantity: number }; product: Product }[];
  }, [cart.lines, productsById]);

  return (
    <div className="appShell">
      <div className="topBar">
        <div className="row">
          <button className="btn" onClick={() => navigate("/client")}>
            Retour menu
          </button>
          <button
            className="btn btnPrimary"
            onClick={() => window.open("/kitchen", "_blank", "noopener,noreferrer")}
          >
            Ouvrir cuisine
          </button>
        </div>
      </div>

      <div className="twoCol">
        <div>
          <div className="card">
            <div className="cardHeader">
              <div className="h1">Votre panier</div>
              <span className="pill">{cartCount} article(s)</span>
            </div>

            {productsError ? <div className="pill pillDanger">{productsError}</div> : null}
            {loadingProducts ? <div className="muted">Chargement...</div> : null}

            {!loadingProducts && cartLines.length === 0 ? (
              <div className="muted">Panier vide. Ajoutez des produits depuis le menu.</div>
            ) : null}

            {!loadingProducts && cartLines.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {cartLines.map(({ line, product }) => (
                  <div key={product.id} className="card" style={{ background: "transparent" }}>
                    <div className="row" style={{ alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, opacity: product.available ? 1 : 0.5 }}>
                          {product.name}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {moneyCentsToEuros(product.priceCents)} • {product.preparationTimeMin} min
                        </div>
                      </div>
                      <div style={{ width: 140 }}>
                        <label>Quantité</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={line.quantity}
                          disabled={!product.available}
                          onChange={(e) => {
                            const q = Number(e.target.value);
                            const next = Math.max(0, Math.floor(Number.isFinite(q) ? q : 0));
                            setCartQuantity(product.id, next);
                            setCartState(getCart());
                          }}
                        />
                        {!product.available ? (
                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            Indisponible
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!loadingProducts && cartLines.length > 0 ? (
              <div style={{ marginTop: 12 }} className="row">
                <div className="muted">Total</div>
                <div className="spacer" />
                <div style={{ fontWeight: 900 }}>{moneyCentsToEuros(totalCents)}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <div className="card">
            <div className="cardHeader">
              <div className="h1">Informations client</div>
              <span className="muted">Pas d’authentification</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);

                const name = form.name.trim();
                const email = form.email.trim();
                const phone = form.phone.trim() ? form.phone.trim() : undefined;

                if (!name) {
                  setError("Le nom est requis.");
                  return;
                }
                if (!safeEmailLooksValid(email)) {
                  setError("Email invalide.");
                  return;
                }

                (async () => {
                  try {
                    const order = await createOrder({
                      customer: { email, name, phone },
                      items: cart.lines,
                    });
                    clearCart();
                    setCartState(getCart());
                    navigate(`/order/${order.id}`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erreur inconnue");
                  }
                })();
              }}
            >
              <div>
                <label>Nom</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <label>Email</label>
                <input
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="client@email.com"
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <label>Téléphone (optionnel)</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>

              {error ? (
                <div style={{ marginTop: 12 }} className="pill pillDanger">
                  {error}
                </div>
              ) : null}

              <button className="btn btnPrimary" type="submit" style={{ marginTop: 12, width: "100%" }}>
                Valider la commande
              </button>
            </form>
          </div>

          {customer ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="cardHeader">
                <div className="h1">Historique</div>
                <span className="pill pillOk">{customer.name}</span>
              </div>

              {customerHistory.length === 0 ? (
                <div className="muted">Aucune commande pour ce client.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {customerHistory.slice(0, 5).map((h) => (
                    <div key={h.orderId} className="card" style={{ padding: 10 }}>
                      <div className="row">
                        <div style={{ fontWeight: 800 }}>Commande {h.orderId.slice(0, 8)}</div>
                        <div className="spacer" />
                        <button className="btn" onClick={() => navigate(`/order/${h.orderId}`)}>
                          Voir
                        </button>
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        {new Date(h.createdAt).toLocaleString("fr-FR")} • {moneyCentsToEuros(h.totalAmountCents)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

