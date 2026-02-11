import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

const RejectRequestDialog = ({ 
  isOpen, 
  onClose, 
  request, 
  reason, 
  setReason, 
  onConfirm 
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] border-4 border-red-200 p-0 overflow-hidden sm:max-w-md bg-gradient-to-b from-red-50 to-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Confirmar Rechazo</DialogTitle>
        </DialogHeader>
        <div className="relative p-6 md:p-8 space-y-6">
          <div className="text-center mb-2">
            <div className="inline-flex items-center gap-2 bg-red-100 px-3 py-1 rounded-full">
              <X className="w-4 h-4 text-red-600" />
              <span className="text-xs font-black text-red-600 uppercase">Confirmar Rechazo</span>
            </div>
          </div>
          
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-800">
                ¿Rechazar solicitud?
              </h3>
              <p className="text-base text-gray-600 font-bold">
                Solicitud de{' '}
                <span className="text-red-600 font-black">{request?.piojologistName}</span>
              </p>
            </div>
          </div>

          <div>
            <Label className="font-bold text-gray-700 ml-2 mb-2 block">Razón del rechazo *</Label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-red-400 focus:bg-white transition-all resize-none"
              placeholder="Explica por qué se rechaza esta solicitud..."
              rows="3"
            />
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
              disabled={!reason.trim()}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-4 font-bold shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5 mr-2" />
              Rechazar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RejectRequestDialog;
