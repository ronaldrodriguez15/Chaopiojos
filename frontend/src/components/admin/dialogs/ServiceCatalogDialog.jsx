import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const ServiceCatalogDialog = ({ 
  isOpen, 
  onClose, 
  editingService, 
  formData, 
  setFormData, 
  onSubmit 
}) => {
  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="rounded-[2.5rem] border-4 border-emerald-200 p-0 sm:max-w-md bg-gradient-to-b from-emerald-50 to-white max-h-[85vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="relative p-6 md:p-8 space-y-4">
          <div className="text-center mb-2">
            <div className="inline-flex items-center gap-2 bg-emerald-100 px-3 py-1 rounded-full">
              <span className="text-lg">{editingService ? '✏️' : '🌟'}</span>
              <span className="text-xs font-black text-emerald-600 uppercase">{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</span>
            </div>
          </div>
          <div>
            <Label className="font-bold text-gray-500 ml-2 mb-1 block">Nombre del Servicio</Label>
            <input
              required
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej. Normal"
            />
          </div>

          <div>
            <Label className="font-bold text-gray-500 ml-2 mb-1 block">Valor</Label>
            <input
              required
              type="number"
              min="1"
              step="1000"
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={formData.value}
              onChange={e => setFormData({ ...formData, value: e.target.value })}
              placeholder="70000"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 rounded-2xl py-6 font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl py-6 font-bold shadow-lg border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all"
            >
              {editingService ? 'Guardar Cambios' : 'Crear Servicio'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceCatalogDialog;
