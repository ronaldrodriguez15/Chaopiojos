import React, { useState, useEffect } from 'react';
import { PackagePlus, Edit, Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Pagination from './Pagination';

const ServicesModule = React.memo(({ 
  services,
  toMoney,
  onOpenServiceDialog,
  onDeleteService
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const maxPage = Math.ceil(services.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) setCurrentPage(maxPage);
    else if (currentPage > 1 && services.length === 0) setCurrentPage(1);
  }, [services.length, currentPage]);

  const paginatedServices = services.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-emerald-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-3">
            <span className="text-3xl">💼</span> Catálogo de Servicios
          </h3>
          <p className="text-sm text-gray-500 font-bold mt-1">Edita los nombres y valores que usa todo el sistema.</p>
        </div>
        <Button
          onClick={() => onOpenServiceDialog()}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl px-4 sm:px-6 py-4 sm:py-6 font-bold text-base sm:text-lg shadow-md hover:shadow-lg border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 w-full sm:w-auto justify-center"
        >
          <PackagePlus className="w-5 h-5 mr-2" /> Nuevo servicio
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-bold text-lg">Aún no hay servicios</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {paginatedServices.map(service => (
            <div key={service.id} className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs font-black text-emerald-700 uppercase">Nombre</p>
                <p className="text-xl font-black text-gray-800">{service.name}</p>
                <p className="text-xs font-black text-emerald-700 uppercase mt-2">Valor</p>
                <p className="text-2xl font-black text-emerald-600">{toMoney(service.value)}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => onOpenServiceDialog(service)}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-4 py-3 font-bold"
                >
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
                <Button
                  onClick={() => onDeleteService(service.id)}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-3 font-bold"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <Pagination
        currentPage={currentPage}
        totalItems={services.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        colorScheme="green"
      />
    </div>
  );
});

ServicesModule.displayName = 'ServicesModule';

export default ServicesModule;
