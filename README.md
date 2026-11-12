# Commerce Pro 🛒📦

Application Desktop professionnelle de **Gestion Commerciale**, **Gestion de Stock**, **Facturation/Tickets avec QR Code** et **Suivi des Comptes & Dettes Clients**, conçue avec **Electron.js**, **React**, **Node.js** et **MongoDB**.

---

## 🌟 Fonctionnalités Principales

### 1. 📦 Gestion Complète de Stock
- **Catalogue d'articles** : Référence, désignation, catégorie, prix d'achat, prix de vente, quantité, unité (pièce, kg, litre, etc.), seuil d'alerte rupture, fournisseur.
- **Génération automatique de QR Code unique** pour chaque article, avec visualiseur et impression directe d'étiquettes de prix / codes-barres.
- **Importation & Exportation Excel** : Importez votre stock en masse depuis n'importe quel fichier Excel (`.xlsx`) ou exportez l'inventaire en un clic.
- **Mouvements & Réapprovisionnement** : Traçabilité des achats fournisseurs et ajustements manuels d'inventaire.

### 2. 🧾 Facturation & Caisse (POS)
- **Point de vente rapide (Caisse)** : Recherche intelligente de produits, scanner code-barres/QR, calcul automatique des sous-totaux, TVA paramétrable et calcul du rendu/dette.
- **Documents personnalisables** : Facture A4 ou Ticket de caisse thermique (80mm).
- **QR Code unique sur facture** : Permet de scanner le ticket/facture pour retrouver instantanément la vente.
- **Retours sur Vente** : Gestion des articles retournés avec ré-incrémentation automatique du stock et remboursement en espèces ou déduction sur compte client.

### 3. 👥 Comptes Clients & Dettes
- **Fiches clients complètes** : Coordonnées, plafond de crédit, solde dette en temps réel.
- **Relevé de compte client (Ledger)** : Historique chronologique de chaque mouvement (crédit vente, règlement reçu, avoir).
- **Encaissements & Décaissements** : Enregistrement simplifié des versements clients pour solder leurs dettes.

### 4. 📊 Tableau de Bord & Statistiques
- **KPIs en temps réel** : Chiffre d'affaires du jour et de la période, marge brute, nombre de ventes, alertes de rupture de stock, total des dettes clients.
- **Filtres de temps flexibles** : Aujourd'hui, Cette semaine, Ce mois, ou Période personnalisée (du ... au ...).
- **Traçabilité totale** : Filtres et exports Excel pour les ventes, les mouvements de stock et les achats fournisseurs.

---

## 🚀 Installation & Démarrage Rapide

### Prérequis
1. **Node.js** (v18 ou supérieur) : [Télécharger Node.js](https://nodejs.org)
2. **MongoDB Community Server** (Local) : [Télécharger MongoDB Community](https://www.mongodb.com/try/download/community)
   - Lors de l'installation de MongoDB sous Windows, laissez cochée l'option *"Install MongoD as a Service"* pour que la base de données démarre automatiquement avec Windows.

### Démarrage en Mode Développement

```bash
# 1. Cloner ou ouvrir le dossier du projet
cd CommercePost

# 2. Installer les dépendances
npm install

# 3. Lancer l'application en mode dev (Vite + Electron)
npm run dev
```

---

## 📦 Empaquetage & Création de l'Exécutable Windows (.exe)

Pour générer l'installateur Windows (`.exe` NSIS avec icône sur le bureau) :

```bash
npm run build
```

Le fichier d'installation sera généré dans le dossier `release/` (ex: `CommercePost Setup 1.0.0.exe`).

---

## 🏗️ Structure du Projet

```text
CommercePost/
├── electron/
│   ├── main.js                  # Point d'entrée principal Electron
│   ├── preload.js               # IPC Bridge sécurisé contextBridge
│   ├── database/
│   │   ├── connection.js        # Gestion connexion MongoDB locale
│   │   └── models/              # Schémas Mongoose (Product, Invoice, Customer, etc.)
│   ├── ipc/                     # Handlers IPC (Stock, Invoice, Customer, Dashboard, Print)
│   └── utils/                   # Génération QR Code, Service Excel (ExcelJS)
├── src/                         # Interface React (Vite + Tailwind CSS + Lucide Icons)
│   ├── components/
│   │   ├── dashboard/           # Tableau de bord & KPIs
│   │   ├── stock/               # CRUD produits, étiquettes QR, import/export
│   │   ├── invoices/            # Caisse, factures, tickets et retours
│   │   ├── customers/           # Suivi des dettes et règlements
│   │   ├── movements/           # Traçabilité des mouvements de stock
│   │   └── layout/              # Sidebar et Topbar
│   └── styles/                  # Styles Tailwind CSS et règles d'impression
├── package.json
└── electron-builder.yml         # Configuration d'empaquetage Windows
```

---

## 📄 Licence
Développé pour **HA Softwares Académie**. Tous droits réservés.
