import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cancelOrder, getOrderById, type Order, type OrderStatus } from "../state/api";
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

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(() => (orderId ? null : null));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const o = await getOrderById(orderId);
        if (!cancelled) setOrder(o);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur");
      }
    };

    tick();
    const t = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [orderId]);

  const totalCents = useMemo(() => order?.items.reduce((sum, i) => sum + i.subtotalCents, 0) ?? 0, [order]);
  const canCancel = order ? order.status === "pending" || order.status === "confirmed" : false;

  return (
    <div className="appShell">
      <div className="topBar">
        <div className="row">
          <div className="brand">Street Bites</div>
          <span className="badge">Confirmation</span>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate("/client")}>
            Menu
          </button>
          <button className="btn btnPrimary" onClick={() => window.open("/kitchen", "_blank", "noopener,noreferrer")}>
            Cuisine
          </button>
        </div>
      </div>

      {!order ? (
        <div className="card">
          <div className="muted">{orderId ? "Chargement commande..." : "Commande introuvable."}</div>
        </div>
      ) : (
        <div className="twoCol">
          <div className="card">
            <div className="cardHeader">
              <div className="h1">Commande {order.id.slice(0, 8)}</div>
              <span className={`pill ${statusPillClass(order.status)}`}>{statusLabel(order.status)}</span>
            </div>

            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              {order.estimatedReadyAt ? (
                <>
                  Estimation : <b>{new Date(order.estimatedReadyAt).toLocaleString("fr-FR")}</b>
                </>
              ) : (
                "Estimation indisponible"
              )}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {order.items.map((it) => (
                <div key={it.productId} className="card" style={{ padding: 10, background: "transparent" }}>
                  <div className="row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800 }}>{it.productName}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {moneyCentsToEuros(it.unitPriceCents)} • {it.quantity} x
                      </div>
                    </div>
                    <div style={{ fontWeight: 900 }}>{moneyCentsToEuros(it.subtotalCents)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }} className="row">
              <div className="muted">Total</div>
              <div className="spacer" />
              <div style={{ fontWeight: 900 }}>{moneyCentsToEuros(totalCents)}</div>
            </div>
          </div>

          <div>
            <div className="card">
              <div className="cardHeader">
                <div className="h1">Suivi</div>
                <span className="muted" style={{ fontSize: 12 }}>Polling toutes les 2s</span>
              </div>

              {error ? <div className="pill pillDanger">{error}</div> : null}

              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {(["pending", "confirmed", "preparing", "ready", "completed"] as OrderStatus[]).map((s) => {
                  const active = order.status === s;
                  const done = order.status !== "cancelled" && (s === "completed" ? order.status === "completed" : order.status === s || order.status === "completed");
                  return (
                    <div
                      key={s}
                      className="row"
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: active ? "rgba(79, 157, 255, 0.12)" : "rgba(255, 255, 255, 0.03)",
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>{statusLabel(s)}</span>
                      <div className="spacer" />
                      <span className={`pill ${done ? "pillOk" : ""}`}>{active ? "Actif" : done ? "Fait" : "A faire"}</span>
                    </div>
                  );
                })}
              </div>

              {canCancel ? (
                <button
                  className="btn btnDanger"
                  style={{ marginTop: 12, width: "100%" }}
                  onClick={async () => {
                    setError(null);
                    try {
                      await cancelOrder({ orderId: order.id });
                      const o = await getOrderById(order.id);
                      setOrder(o);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erreur inconnue");
                    }
                  }}
                >
                  Annuler la commande
                </button>
              ) : (
                <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
                  Annulation indisponible pour ce statut.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

