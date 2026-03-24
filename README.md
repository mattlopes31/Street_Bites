# Street_Bites

## Front-end React (fonctionnel)

Le cahier des charges (menu, panier/commande, confirmation, cuisine) a été implémenté côté front avec une “mini base” persistée en `localStorage`, pour que ce soit testable tout de suite.

### Lancer

1. Ouvrir un terminal dans `frontend`
2. Exécuter :
   - `npm install`
   - `npm run dev`
3. Aller sur l’URL affichée (Vite).

### Routes

- `/` : page de démarrage (ouvre les 2 onglets : `Client` / `Cuisine`)
- `/client` : page `Menu` (catégories + produits, ajout au panier, produits indisponibles grisés)
- `/cart` : panier + formulaire client + historique si email reconnu + validation commande
- `/order/:orderId` : récap + statut + polling/rafraîchissement
- `/kitchen` : gestion menu (CRUD catégories/produits + toggle dispo) + gestion commandes (transitions de statuts)

## Back-end Microservices (Node/Express + Prisma)
Le backend est découpé en 3 services :
- `menu-service` : catégories & produits
- `client-service` : clients & historique de commandes
- `order-service` : création/transition/annulation des commandes (orchestration entre services)

### Lancer
1. Configurer les variables d’environnement :
   - `frontend/.env.example` (ports backend)
   - `services/*/.env.example` (au minimum `DATABASE_URL`)
2. (Si besoin) créer les tables :
   - `cd services/menu && npm run prisma:migrate`
   - `cd services/client && npm run prisma:migrate`
   - `cd services/order && npm run prisma:migrate`
3. Démarrer les services :
   - `cd services/menu && npm run dev`
   - `cd services/client && npm run dev`
   - `cd services/order && npm run dev`

Ensuite, lancer le front :
- `cd frontend && npm run dev`