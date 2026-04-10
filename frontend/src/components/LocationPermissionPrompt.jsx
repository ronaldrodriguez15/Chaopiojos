import React from 'react';
import { AlertTriangle, LocateFixed, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';

const visibleStatuses = new Set(['idle', 'prompt', 'denied', 'unavailable', 'timeout', 'unsupported', 'error']);

const statusCopy = {
  idle: {
    title: 'Permiso de ubicación',
    description: 'Para operar en la plataforma necesitamos activar tu ubicación.',
  },
  prompt: {
    title: 'Activa tu ubicación',
    description: 'El navegador te pedirá permiso para compartir la ubicación con administración.',
  },
  denied: {
    title: 'Ubicación bloqueada',
    description: 'Usa el botón para intentar solicitarla de nuevo. Si el navegador la mantiene bloqueada, habilítala desde la configuración del sitio.',
  },
  unavailable: {
    title: 'Ubicación no disponible',
    description: 'Revisa el GPS, la conexión o los permisos del dispositivo e inténtalo de nuevo.',
  },
  timeout: {
    title: 'Ubicación sin respuesta',
    description: 'El navegador tardó demasiado. Puedes volver a solicitarla.',
  },
  unsupported: {
    title: 'Ubicación no soportada',
    description: 'Este navegador no permite compartir ubicación.',
  },
  error: {
    title: 'No se pudo leer la ubicación',
    description: 'Intenta solicitar el permiso nuevamente.',
  },
};

const LocationPermissionPrompt = ({ status, errorMessage, isRequesting, onRequest }) => {
  if (!visibleStatuses.has(status)) return null;

  const copy = statusCopy[status] || statusCopy.error;

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 md:p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black text-amber-900">{copy.title}</p>
            <p className="text-xs font-bold text-amber-800 md:text-sm">
              {errorMessage || copy.description}
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={onRequest}
          disabled={isRequesting || status === 'unsupported'}
          className="h-11 rounded-xl bg-amber-500 px-4 font-black text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {isRequesting ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
          Solicitar ubicación
        </Button>
      </div>
    </div>
  );
};

export default LocationPermissionPrompt;
