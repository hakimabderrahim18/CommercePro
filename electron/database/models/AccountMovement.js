const mongoose = require('mongoose');

const AccountMovementSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    type: {
      type: String,
      enum: [
        'DETTE_VENTE',             // Nouvelle dette créée suite à vente impayée/partielle
        'ENCAISSEMENT_REGLEMENT',  // Paiement reçu du client pour rembourser une dette
        'DECAISSEMENT_AVOIR',      // Restitution d'avoir / remboursement au client
        'AJUSTEMENT'               // Ajustement manuel du solde
      ],
      required: true
    },
    montant: {
      type: Number,
      required: true
    },
    soldeAvant: {
      type: Number,
      required: true
    },
    soldeApres: {
      type: Number,
      required: true
    },
    factureAssociee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null
    },
    retourAssocie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleReturn',
      default: null
    },
    modeReglement: {
      type: String,
      enum: ['ESPECES', 'CARTE', 'VIREMENT', 'CHEQUE', 'AUTRE'],
      default: 'ESPECES'
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

module.exports = mongoose.model('AccountMovement', AccountMovementSchema);
