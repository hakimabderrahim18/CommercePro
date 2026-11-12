const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
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
  prixUnitaire: {
    type: Number,
    required: true
  },
  prixAchatUnitaire: {
    type: Number,
    default: 0
  },
  quantite: {
    type: Number,
    required: true,
    min: 0.001
  },
  totalLigne: {
    type: Number,
    required: true
  }
});

const InvoiceSchema = new mongoose.Schema(
  {
    numeroFacture: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    typeDocument: {
      type: String,
      enum: ['FACTURE', 'TICKET'],
      default: 'FACTURE'
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null
    },
    nomClientLibre: {
      type: String,
      default: 'Client Comptoir'
    },
    items: [InvoiceItemSchema],
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
      required: true,
      default: 0
    },
    montantReste: {
      type: Number,
      default: 0
    },
    modePaiement: {
      type: String,
      enum: ['ESPECES', 'CARTE', 'VIREMENT', 'CHEQUE', 'A_CREDIT', 'MIXTE'],
      default: 'ESPECES'
    },
    statutPaiement: {
      type: String,
      enum: ['PAYE', 'PARTIEL', 'NON_PAYE'],
      default: 'PAYE'
    },
    qrCodeData: {
      type: String,
      default: ''
    },
    qrCodeImage: {
      type: String,
      default: ''
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

module.exports = mongoose.model('Invoice', InvoiceSchema);
