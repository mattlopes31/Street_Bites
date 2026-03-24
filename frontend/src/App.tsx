import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import StartPage from "./pages/StartPage";
import MenuPage from "./pages/MenuPage";
import CartPage from "./pages/CartPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import KitchenPage from "./pages/KitchenPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/client" element={<MenuPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/order/:orderId" element={<OrderConfirmationPage />} />
      <Route path="/kitchen" element={<KitchenPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

