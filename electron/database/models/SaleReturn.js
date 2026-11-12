const mongoose = require('mongoose');

const SaleReturnSchema = new mongoose.Schema(
  {
    numeroRetour: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    facture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        reference: { type: String, required: true },
        nom: { type: String, required: true },
        quantite: { type: Number, required: true, min: 0.001 },
        prixUnitaire: { type: Number, required: true },
        totalLigne: { type: Number, required: true }
      }
    ],
    motif: {
      type: String,
      required: [true, 'Le motif du retour est obligatoire'],
      trim: true
    },
    totalRembourse: {
      type: Number,
      required: true,
      min: 0
    },
    modeRemboursement: {
      type: String,
      enum: ['ESPECES', 'AVOIR_CLIENT', 'DEDUCTION_DETTE'],
      default: 'ESPECES'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SaleReturn', SaleReturnSchema);
