const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: [true, 'La référence du produit est obligatoire'],
      unique: true,
      trim: true,
      uppercase: true
    },
    nom: {
      type: String,
      required: [true, 'Le nom du produit est obligatoire'],
      trim: true
    },
    categorie: {
      type: String,
      default: 'Général',
      trim: true
    },
    prixAchat: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    prixVente: {
      type: Number,
      required: [true, 'Le prix de vente est obligatoire'],
      min: 0
    },
    quantite: {
      type: Number,
      required: true,
      default: 0
    },
    seuilAlerte: {
      type: Number,
      default: 5
    },
    unite: {
      type: String,
      default: 'pcs',
      trim: true
    },
    fournisseur: {
      type: String,
      default: '',
      trim: true
    },
    codeBarre: {
      type: String,
      default: '',
      trim: true,
      uppercase: true
    },
    barcodeData: {
      type: String,
      default: ''
    },
    barcodeImage: {
      type: String,
      default: ''
    },
    qrCodeData: {
      type: String,
      default: ''
    },
    qrCodeImage: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      default: ''
    },
    statut: {
      type: String,
      enum: ['ACTIF', 'ARCHIVE'],
      default: 'ACTIF'
    }
  },
  {
    timestamps: true
  }
);

// Virtual for low stock
ProductSchema.virtual('isEnRupture').get(function () {
  return this.quantite <= this.seuilAlerte;
});

module.exports = mongoose.model('Product', ProductSchema);
