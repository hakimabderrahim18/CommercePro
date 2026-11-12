# Commerce Pro 🛒📦⚡

Application Desktop tout-en-un de **Gestion Commerciale**, **Stock & Réapprovisionnement**, **Facturation & Point de Vente (POS)**, **Service Après-Vente (SAV / Réparations)** et **Trésorerie**, conçue avec **Electron.js**, **React 18**, **Tailwind CSS** et base de données embarquée **SQLite (sql.js)**.

---

## 🌟 Fonctionnalités Principales

### 1. 📦 Gestion Complète de Stock & Inventaire
- **Catalogue d'articles** : Référence, code-barres, désignation, catégorie, prix d'achat, prix de vente, quantité en stock, seuils d'alerte, unité.
- **Génération & Impression d'étiquettes QR Code & Code-Barres** personnalisables.
- **Importation & Exportation Excel (`.xlsx`)** en masse.
- **Mouvements & Historique** : Traçabilité détaillée des entrées, sorties, ventes et consommations pièces SAV.

### 2. 🧾 Point de Vente (POS) & Facturation
- **Caisse rapide & ergonomique** : Recherche instantanée, lecteur code-barres/QR, remises, TVA, calcul automatique de monnaie et crédit.
- **Tickets thermiques (80mm) et Factures A4** avec logos, mentions légales et QR code de vérification.
- **Retours sur ventes & Avoirs** avec remise en stock automatique.
- **Gestion des Pertes & Avaries**.

### 3. 👥 Clients, Fournisseurs & Dettes
- **Fiches clients & fournisseurs complètes** avec solde dette en direct.
- **Relevé de compte chronologique (Ledger)** pour chaque tiers.
- **Règlements, acomptes et décaissements** avec reçu imprimable.

### 4. 🛠️ Module SAV & Réparations Spécialisé
- **Prise en charge d'appareils** : Client, panne déclarée, mot de passe/schéma, accessoires, devis estimatif.
- **Consommation de pièces détachées** : Liaison directe avec le stock de produits du magasin.
- **Gestion des techniciens** : Affectation des réparations, commissions et suivi des comptes techniciens.
- **Impression d'étiquettes de dépôt et de fiches de sortie**.

### 5. 💰 Trésorerie & Caisse Journalière
- **Suivi des flux financiers** : Espèces, carte bancaire, virement, chèque.
- **Clôture de caisse quotidienne** avec impression du rapport de fin de journée.

### 6. 🔐 Système de Licence Matérielle Sécurisé
- **Empreinte matérielle unique** liée à la machine (Carte mère / GUID / Processeur).
- **Générateur de licences dédié** ([Generateur_Licences.html](Generateur_Licences.html)) pour émettre des clés d'activation permanentes ou temporaires.

### 7. 🚀 Mises à Jour Automatiques en Ligne (GitHub Releases)
- **Vérification automatique en arrière-plan** au lancement de l'application.
- **Téléchargement & Installation en 1 clic** directement depuis GitHub Releases.

---

## 🚀 Installation & Développement

### Prérequis
- **Node.js** (v18 ou supérieur) : [Télécharger Node.js](https://nodejs.org)
- *(Aucun serveur de base de données externe requis ! SQLite est autonome et embarqué).*

### Démarrage en Mode Développement

```bash
# 1. Cloner le projet
git clone https://github.com/hakimabderrahim18/CommercePro.git
cd CommercePro

# 2. Installer les dépendances
npm install

# 3. Lancer l'application en mode dev (React + Electron)
npm run dev
```

---

## 📦 Compilation & Déploiement

### Générer l'application pour Windows

```bash
npm run build
```

L'exécutable final configuré avec l'icône personnalisée se trouvera dans :
`release/win-unpacked/CommercePro.exe`

---

## 🔄 Comment Publier une Nouvelle Version (Mise à Jour Client)

1. Mettre à jour la version dans [package.json](package.json) (ex: `"version": "1.0.1"`).
2. Compiler le projet :
   ```bash
   npm run build
   ```
3. Rendez-vous sur votre dépôt GitHub :  
   👉 [https://github.com/hakimabderrahim18/CommercePro/releases/new](https://github.com/hakimabderrahim18/CommercePro/releases/new)
4. Renseignez le tag : `v1.0.1`.
5. Glissez-déposez le dossier zippé ou l'exécutable `CommercePro.exe`.
6. Cliquez sur **"Publish release"**.

Dès que la release est publiée, tous vos clients recevront une notification dans leur logiciel et pourront se mettre à jour en un clic !

---

## 📄 Licence
Propriété exclusive de **HA Softwares Académie**. Tous droits réservés.
