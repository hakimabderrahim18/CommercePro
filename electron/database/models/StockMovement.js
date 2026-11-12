const mongoose = require('mongoose');

const StockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    type: {
      type: String,
      enum: [
        'ACHAT_FOURNISSEUR',
        'VENTE',
        'RETOUR_VENTE',
        'AJUSTEMENT_INVENTAIRE',
        'IMPORT_EXCEL'
      ],
      required: true
    },
    quantite: {
      type: Number,
      required: true // Positif pour entrée, négatif pour sortie
    },
    quantiteAvant: {
      type: Number,
      required: true
    },
    quantiteApres: {
      type: Number,
      required: true
    },
    prixAchatUnitaire: {
      type: Number,
      default: 0
    },
    fournisseur: {
      type: String,
      default: '',
      trim: true
    },
    referenceDocument: {
      type: String,
      default: '',
      trim: true
    },
    motif: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StockMovement', StockMovementSchema);
