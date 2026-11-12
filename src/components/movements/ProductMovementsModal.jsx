import React from 'react';
import Modal from '../common/Modal';
import ProductMovementsSection from './ProductMovementsSection';

export default function ProductMovementsModal({ isOpen, onClose, product }) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? `Historique Mouvements : ${product.nom}` : 'Historique des Mouvements de Produit'}
      maxWidth="max-w-6xl"
    >
      <div className="pt-1">
        <ProductMovementsSection initialProductId={product?.id || product?._id} />
      </div>
    </Modal>
  );
}
