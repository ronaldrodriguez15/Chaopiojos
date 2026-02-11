import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

const DeleteConfirmDialog = ({ isOpen, onClose, item, deleteType, onConfirm }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] border-4 border-red-200 p-0 overflow-hidden sm:max-w-md bg-gradient-to-b from-red-50 to-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Confirmar Eliminación</DialogTitle>
        </DialogHeader>
        <div className="relative p-6 md:p-8 space-y-6">
          <div className="text-center mb-2">
            <div className="inline-flex items-center gap-2 bg-red-100 px-3 py-1 rounded-full">
              <Trash2 className="w-4 h-4 text-red-600" />
              <span className="text-xs font-black text-red-600 uppercase">Confirmar Eliminación</span>
            </div>
          </div>
          
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-800">
                ¿Estás seguro?
              </h3>
              {deleteType === 'product' && (
                <p className="text-base text-gray-600 font-bold">
                  El producto{' '}
                  <span className="text-red-600 font-black">"{item?.name}"</span>{' '}
                  será eliminado permanentemente.
                </p>
              )}
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
