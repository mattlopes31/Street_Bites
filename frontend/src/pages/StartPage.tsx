import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { clearCart } from "../state/cart";

export default function StartPage() {
  const navigate = useNavigate();

  const openClient = useMemo(() => {
    return () => window.open("/client", "_blank", "noopener,noreferrer");
  }, []);

  const openKitchen = useMemo(() => {
    return () => window.open("/kitchen", "_blank", "noopener,noreferrer");
  }, []);

  return (
    <div className="appShell">
      <div className="topBar">
        <div className="row">
          <div className="brand">Street Bites</div>
          <span className="badge">Démo microservices - front local</span>
        </div>
        <div className="row">
          <span className="pill">Devise : EUR</span>
        </div>
      </div>

      <div className="grid grid2">
        <div className="card">
          <div className="cardHeader">
            <div className="h1">Ouvrir un onglet Client</div>
            <span className="muted">Commande depuis le menu</span>
          </div>
          <p className="muted">
            Le client choisit des produits, valide la commande, puis suit le statut.
          </p>
          <div className="row">
            <button className="btn btnPrimary" onClick={openClient}>
              Ouvrir “Client”
            </button>
            <button className="btn" onClick={() => navigate("/client")}>
              Aller (même onglet)
            </button>
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <div className="h1">Ouvrir un onglet Cuisine</div>
            <span className="muted">Recevoir et préparer</span>
          </div>
          <p className="muted">
            La cuisine reçoit la commande et fait passer les statuts (confirmed → preparing → ready → completed).
          </p>
          <div className="row">
            <button className="btn btnOk" onClick={openKitchen}>
              Ouvrir “Cuisine”
            </button>
            <button className="btn" onClick={() => navigate("/kitchen")}>
              Aller (même onglet)
            </button>
          </div>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="cardHeader">
            <div className="h1">Initialisation locale</div>
            <span className="muted">localStorage (panier uniquement)</span>
          </div>
          <p className="muted">
            Si vous avez laissé des commandes ou modifié le menu, vous pouvez réinitialiser la mini base.
          </p>
          <div className="row">
            <button
              className="btn btnDanger"
              onClick={() => {
                clearCart();
                window.location.reload();
              }}
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

