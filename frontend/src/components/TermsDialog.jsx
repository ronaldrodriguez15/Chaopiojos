import React from 'react';
import { FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TERMS_ROLE_LABELS, getTermsByRole } from '@/lib/termsConditions';

const TermsDialog = ({ open, onOpenChange, role, termsSettings }) => {
  const title = TERMS_ROLE_LABELS[role] || 'Usuario';
  const termsText = getTermsByRole(termsSettings, role);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2rem] border-4 border-rose-200 bg-rose-50 p-0 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Términos y condiciones</DialogTitle>
        </DialogHeader>

        <div className="bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center border border-white/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] font-black text-white/80">Documento</p>
              <h2 className="text-2xl font-black">Términos y condiciones</h2>
              <p className="text-sm font-bold text-white/90 mt-1">{title}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="rounded-[1.5rem] border-2 border-rose-100 bg-white p-5 max-h-[60vh] overflow-y-auto">
            <div className="whitespace-pre-line text-sm md:text-[15px] leading-7 font-bold text-slate-700">
              {termsText}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TermsDialog;
