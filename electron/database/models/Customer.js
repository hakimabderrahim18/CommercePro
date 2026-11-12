const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: [true, 'Le nom du client est obligatoire'],
      trim: true
    },
    telephone: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    adresse: {
      type: String,
      trim: true,
      default: ''
    },
    soldeDette: {
      type: Number,
      default: 0
    },
    plafondCredit: {
      type: Number,
      default: 0 // 0 = sans limite
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

module.exports = mongoose.model('Customer', CustomerSchema);
