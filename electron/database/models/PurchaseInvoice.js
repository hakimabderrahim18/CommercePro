const mongoose = require('mongoose');

const PurchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  reference: {
    type: String,
    required: true
  },
  nom: {
    type: String,
    required: true
  },
  quantite: {
    type: Number,
    required: true,
    min: 0.001
  },
  prixAchatUnitaire: {
    type: Number,
    required: true,
    min: 0
  },
  totalLigne: {
    type: Number,
    required: true
  }
});

const PurchaseInvoiceSchema = new mongoose.Schema(
  {
    numeroFactureAchat: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    fournisseur: {
      type: String,
      required: [true, 'Le nom du fournisseur est obligatoire'],
      trim: true
    },
    contactFournisseur: {
      type: String,
      default: '',
      trim: true
    },
    items: [PurchaseItemSchema],
    totalHT: {
      type: Number,
      required: true,
      default: 0
    },
    tauxTva: {
      type: Number,
      default: 0
    },
    montantTva: {
      type: Number,
      default: 0
    },
    totalTTC: {
      type: Number,
      required: true
    },
    montantPaye: {
      type: Number,
      default: 0
    },
    modePaiement: {
      type: String,
      enum: ['ESPECES', 'VIREMENT', 'CHEQUE', 'A_CREDIT', 'CARTE'],
      default: 'ESPECES'
    },
    statutPaiement: {
      type: String,
      enum: ['PAYE', 'PARTIEL', 'NON_PAYE'],
      default: 'PAYE'
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PurchaseInvoice', PurchaseInvoiceSchema);
