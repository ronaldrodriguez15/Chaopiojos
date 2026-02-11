import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';

const ProductDetailDialog = ({ 
  isOpen, 
  onClose, 
  product, 
  formatCurrency,
  getImageUrl,
  onEdit,
  onDelete
}) => {
  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] border-4 border-pink-200 p-0 overflow-hidden sm:max-w-lg bg-gradient-to-b from-pink-50 to-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Producto Mágico</DialogTitle>
        </DialogHeader>
        
        <div className="relative p-6 md:p-8 space-y-6">
          <div className="text-center mb-2">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-100 to-purple-100 px-3 py-1 rounded-full">
              <span className="text-lg">✨</span>
              <span className="text-xs font-black text-pink-600 uppercase">Producto Mágico</span>
            </div>
          </div>

          <div className="w-full h-64 bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl overflow-hidden border-4 border-pink-200 shadow-lg relative">
            <img 
              src={getImageUrl(product.image)} 
              alt={product.name} 
              className="w-full h-full object-contain object-center"
            />
            <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-full shadow-lg border-2 border-pink-300">
              <span className="text-2xl font-black text-pink-500">📦 {product.stock}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-pink-50 p-4 rounded-2xl border-2 border-pink-200">
              <h3 className="text-2xl font-black text-gray-800 mb-2">
                {product.name}
              </h3>
              <p className="text-3xl font-black text-pink-500">
                {formatCurrency(product.price)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-50 p-4 rounded-2xl border-2 border-purple-200 text-center">
                <p className="text-sm font-bold text-purple-600 mb-1">Stock Disponible</p>
                <p className="text-3xl font-black text-purple-700">{product.stock}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-200 text-center">
                <p className="text-sm font-bold text-blue-600 mb-1">Precio Unitario</p>
                <p className="text-lg font-black text-blue-700">{formatCurrency(product.price)}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl py-6 font-bold shadow-lg border-b-4 border-blue-700"
            >
              <Edit className="w-5 h-5 mr-2" /> Editar
            </Button>
            <Button
              onClick={() => {
                onDelete(product.id);
                onClose();
              }}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-6 font-bold shadow-lg border-b-4 border-red-700"
            >
              <Trash2 className="w-5 h-5 mr-2" /> Eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailDialog;
