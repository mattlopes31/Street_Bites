import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addToCart, getCart, moneyCentsToEuros, useCart } from "../state/cart";
import { getCategoryWithProducts, listCategories, type Category, type Product } from "../state/api";

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: () => void;
}) {
  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>{product.name}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {moneyCentsToEuros(product.priceCents)} • {product.preparationTimeMin} min
          </div>
        </div>
        <div className="pill" style={{ marginLeft: 10 }}>
          {product.available ? "Disponible" : "Indisponible"}
        </div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className={`btn ${product.available ? "btnPrimary" : ""}`}
          disabled={!product.available}
          onClick={onAdd}
          style={{ width: "100%", opacity: product.available ? 1 : 0.55 }}
          title={product.available ? "Ajouter au panier" : "Produit indisponible"}
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const navigate = useNavigate();
  const { cart, setCartState, cartCount } = useCart();

  const [categoriesWithProducts, setCategoriesWithProducts] = useState<
    Array<{ category: Category; products: Product[] }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const cats = await listCategories();
        const details = await Promise.all(
          cats.map(async (cat) => {
            const { category, products } = await getCategoryWithProducts(cat.id);
            return { category, products };
          }),
        );
        if (!cancelled) setCategoriesWithProducts(details);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur chargement menu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedCategories = useMemo(() => {
    return [...categoriesWithProducts].sort((a, b) => a.category.displayOrder - b.category.displayOrder);
  }, [categoriesWithProducts]);

  return (
    <div className="appShell">
      <div className="topBar">
        <div className="row">
          <div className="brand">Street Bites</div>
          <span className="badge">Mode Client</span>
        </div>
        <div className="row">
          <span className="badge">
            Panier : {cartCount} article{cartCount > 1 ? "s" : ""}
          </span>
          <button className="btn btnPrimary" onClick={() => navigate("/cart")}>
            Aller au panier
          </button>
        </div>
      </div>

      {cartCount === 0 ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="muted">
            Ajoutez des produits depuis le menu. Les produits indisponibles sont grisés.
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <div className="muted">Chargement du menu...</div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="pill pillDanger">{error}</div>
        </div>
      ) : (
        <div className="grid grid2">
          {sortedCategories.map(({ category: cat, products }) => {
            return (
            <div key={cat.id} className="card">
              <div className="cardHeader">
                <div className="h1">{cat.name}</div>
                <div className="pill">{products.length} produits</div>
              </div>
              <div className="grid grid3" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                {products.map((p) => {
                  const isInCart = cart.lines.some((l) => l.productId === p.id);
                  return (
                    <div key={p.id} style={{ filter: p.available ? "none" : "grayscale(1)" }}>
                      <ProductCard
                        product={p}
                        onAdd={() => {
                          addToCart(p.id, 1);
                          setCartState(getCart());
                        }}
                      />
                      {isInCart ? (
                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          Dans le panier
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <Link className="btn" to="/kitchen" target="_blank" rel="noreferrer">
            Ouvrir cuisine (2e onglet)
          </Link>
          <span className="muted">
            Pour tester : utilisez “Client” et “Cuisine” dans deux onglets différents.
          </span>
          <div className="spacer" />
          <button className="btn" onClick={() => navigate("/")}>
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}

