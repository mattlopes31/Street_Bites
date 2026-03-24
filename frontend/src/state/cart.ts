import { useEffect, useMemo, useState } from "react";

export type CartLine = { productId: string; quantity: number };
export type Cart = { lines: CartLine[] };

const CART_KEY = "street-bites:cart:v1";

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getCart(): Cart {
  return safeParseJson<Cart>(localStorage.getItem(CART_KEY)) ?? { lines: [] };
}

export function setCart(cart: Cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function addToCart(productId: string, quantityDelta: number) {
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

export function setCartQuantity(productId: string, quantity: number) {
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

export function useCart() {
  const [cart, setCartState] = useState<Cart>(() => getCart());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) setCartState(getCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const cartCount = useMemo(() => cart.lines.reduce((s, l) => s + l.quantity, 0), [cart.lines]);

  return { cart, setCartState, cartCount };
}

export function moneyCentsToEuros(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

