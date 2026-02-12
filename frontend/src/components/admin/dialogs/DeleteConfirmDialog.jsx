import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

const DeleteConfirmDialog = ({ isOpen, onClose, item, itemType = 'producto', deleteType, onConfirm }) => {
  const typeLabel = itemType || (deleteType === 'service' ? 'servicio' : 'producto');
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[3rem] border-4 border-red-400 p-0 overflow-hidden sm:max-w-md bg-red-50 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Confirmar Eliminación</DialogTitle>
        </DialogHeader>
        <div className="text-center pt-8 pb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trash2 className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl font-black text-red-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
              CONFIRMAR ELIMINACIÓN
            </h2>
          </div>
        </div>
        <div className="px-6 md:px-8 pb-8 space-y-6">
          
          <div className="text-center space-y-4">  
            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-800">
                ¿Estás seguro?
              </h3>
              <p className="text-base text-gray-600 font-bold">
                {item?.name ? (
                  <>
                    El {typeLabel}{' '}
                    <span className="text-red-600 font-black">"{item?.name}"</span>{' '}
                    será eliminado permanentemente.
                  </>
                ) : (
                  `Este ${typeLabel} será eliminado permanentemente.`
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl py-4 font-bold border-2 border-gray-300"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-4 font-bold shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
