import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Image as ImageIcon, Phone, RefreshCw, Search, Store, UserSquare2, Download, CalendarDays } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Pagination from './Pagination';
import { sellerVisitService } from '@/lib/api';

const ITEMS_PER_PAGE = 8;

const normalize = (value) => String(value || '').trim().toLowerCase();

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha inválida';
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getMonthValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
};

const SellerVisitsModule = React.memo(() => {
  const { toast } = useToast();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [filters, setFilters] = useState({
    sellerId: 'all',
    search: '',
    month: 'all',
    photo: 'all',
  });

  const loadVisits = async () => {
    setLoading(true);
    const result = await sellerVisitService.getAll({ force: true });
    setLoading(false);

    if (result.success) {
      setVisits(result.visits || []);
      return;
    }

    toast({
      title: 'Error',
      description: result.message || 'No se pudo cargar el historial de visitas de vendedores',
      variant: 'destructive',
      className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
    });
  };

  useEffect(() => {
    loadVisits();
  }, []);

  const sellers = useMemo(() => (
    [...new Map(
      visits
        .filter((item) => item?.seller?.id)
        .map((item) => [item.seller.id, item.seller])
    ).values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'))
  ), [visits]);

  const months = useMemo(() => (
    [...new Set(
      visits
        .map((item) => getMonthValue(item.created_at))
        .filter(Boolean)
    )].sort((a, b) => b.localeCompare(a))
  ), [visits]);

  const filteredVisits = useMemo(() => {
    const searchValue = normalize(filters.search);

    return visits.filter((item) => {
      const matchesSeller = filters.sellerId === 'all' || String(item?.seller?.id || '') === filters.sellerId;
      const matchesMonth = filters.month === 'all' || getMonthValue(item.created_at) === filters.month;
      const matchesPhoto = filters.photo === 'all'
        || (filters.photo === 'with_photo' && Boolean(item.place_photo_url))
        || (filters.photo === 'without_photo' && !item.place_photo_url);

      const haystack = [
        item.business_name,
        item.owner_name,
        item.whatsapp,
        item.seller?.name,
        item.seller?.email,
      ].map(normalize).join(' ');

      const matchesSearch = !searchValue || haystack.includes(searchValue);

      return matchesSeller && matchesMonth && matchesPhoto && matchesSearch;
    });
  }, [filters, visits]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredVisits.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, filteredVisits.length]);

  const paginatedVisits = filteredVisits.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const summary = useMemo(() => {
    const now = new Date();
    const thisMonth = visits.filter((item) => {
      const date = new Date(item.created_at);
      return !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;

    return {
      total: visits.length,
      filtered: filteredVisits.length,
      withPhoto: visits.filter((item) => item.place_photo_url).length,
      sellers: new Set(visits.map((item) => item.seller?.id).filter(Boolean)).size,
      thisMonth,
    };
  }, [filteredVisits.length, visits]);

  const visibleStart = filteredVisits.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1;
  const visibleEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredVisits.length);

  return (
    <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-orange-100 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-gray-800">Visitas de vendedores</h3>
          <p className="text-sm font-bold text-gray-500 mt-1">Historial centralizado de visitas comerciales registradas por todos los vendedores.</p>
        </div>
        <Button type="button" onClick={loadVisits} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-bold w-full sm:w-auto">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
          <p className="text-xs uppercase tracking-wide font-black text-orange-600">Total</p>
          <p className="text-3xl font-black text-gray-800 mt-2">{summary.total}</p>
        </div>
        <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
          <p className="text-xs uppercase tracking-wide font-black text-orange-600">Filtradas</p>
          <p className="text-3xl font-black text-gray-800 mt-2">{summary.filtered}</p>
        </div>
        <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
          <p className="text-xs uppercase tracking-wide font-black text-orange-600">Este mes</p>
          <p className="text-3xl font-black text-gray-800 mt-2">{summary.thisMonth}</p>
        </div>
        <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
          <p className="text-xs uppercase tracking-wide font-black text-orange-600">Con foto</p>
          <p className="text-3xl font-black text-gray-800 mt-2">{summary.withPhoto}</p>
        </div>
        <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
          <p className="text-xs uppercase tracking-wide font-black text-orange-600">Vendedores</p>
          <p className="text-3xl font-black text-gray-800 mt-2">{summary.sellers}</p>
        </div>
      </div>

      <div className="rounded-[2rem] border-4 border-orange-100 bg-orange-50/70 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-orange-600" />
          <h4 className="text-lg font-black text-gray-800">Filtros</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-orange-700 mb-2">Vendedor</label>
            <select
              value={filters.sellerId}
              onChange={(e) => setFilters((prev) => ({ ...prev, sellerId: e.target.value }))}
              className="w-full rounded-2xl border-2 border-orange-200 bg-white p-3 font-bold text-gray-700 outline-none focus:border-orange-400"
            >
              <option value="all">Todos</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={String(seller.id)}>{seller.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-orange-700 mb-2">Establecimiento o contacto</label>
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full rounded-2xl border-2 border-orange-200 bg-white p-3 font-bold text-gray-700 outline-none focus:border-orange-400"
              placeholder="Buscar negocio, dueño, WhatsApp..."
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-orange-700 mb-2">Mes</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}
              className="w-full rounded-2xl border-2 border-orange-200 bg-white p-3 font-bold text-gray-700 outline-none focus:border-orange-400"
            >
              <option value="all">Todos</option>
              {months.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-orange-700 mb-2">Foto</label>
            <select
              value={filters.photo}
              onChange={(e) => setFilters((prev) => ({ ...prev, photo: e.target.value }))}
              className="w-full rounded-2xl border-2 border-orange-200 bg-white p-3 font-bold text-gray-700 outline-none focus:border-orange-400"
            >
              <option value="all">Todas</option>
              <option value="with_photo">Con foto</option>
              <option value="without_photo">Sin foto</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[2rem] border-4 border-orange-100 bg-orange-50 p-10 text-center font-bold text-orange-700">Cargando visitas...</div>
      ) : filteredVisits.length === 0 ? (
        <div className="rounded-[2rem] border-4 border-dashed border-orange-200 bg-orange-50 p-10 text-center font-bold text-orange-700">No hay visitas que coincidan con los filtros actuales.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
            <p className="text-sm font-bold text-gray-600">Mostrando {visibleStart}-{visibleEnd} de {filteredVisits.length} visitas</p>
            <p className="text-xs font-black uppercase tracking-wide text-orange-600">Página {currentPage}</p>
          </div>

          {paginatedVisits.map((item) => (
            <div key={item.id} className="rounded-[2rem] border-4 border-orange-100 bg-orange-50/60 p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex items-start gap-3">
                  {item.place_photo_url ? (
                    <img src={item.place_photo_url} alt={item.business_name} className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-200 bg-white flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-white border-2 border-orange-200 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-orange-400" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-lg font-black text-gray-800">{item.business_name}</p>
                    <p className="text-sm font-bold text-gray-600">{item.owner_name || 'Dueño sin registrar'}</p>
                    <p className="text-xs font-bold text-gray-500">{formatDateTime(item.created_at)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setSelectedVisit(item)} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-bold">
                    <Eye className="w-4 h-4 mr-2" />
                    Ver registro
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm font-semibold text-gray-700">
                <div className="bg-white rounded-xl border border-orange-100 p-3 flex items-start gap-2">
                  <UserSquare2 className="w-4 h-4 mt-0.5 text-orange-600" />
                  <div>
                    <p>{item.seller?.name || 'Sin vendedor asignado'}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.seller?.email || 'Sin correo'}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-orange-100 p-3 flex items-start gap-2">
                  <Phone className="w-4 h-4 mt-0.5 text-orange-600" />
                  <div>
                    <p>{item.whatsapp || 'Sin WhatsApp'}</p>
                    <p className="text-xs text-gray-500 mt-1">Contacto del negocio</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-orange-100 p-3 flex items-start gap-2">
                  <Store className="w-4 h-4 mt-0.5 text-orange-600" />
                  <div>
                    <p>{item.business_name || 'Sin negocio'}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.place_photo_url ? 'Con evidencia fotográfica' : 'Sin foto cargada'}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Pagination
            currentPage={currentPage}
            totalItems={filteredVisits.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            colorScheme="orange"
          />
        </div>
      )}

      <Dialog open={Boolean(selectedVisit)} onOpenChange={(open) => !open && setSelectedVisit(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-orange-400 p-0 overflow-hidden sm:max-w-2xl bg-orange-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle de la visita</DialogTitle>
          </DialogHeader>
          {selectedVisit && (
            <div className="max-h-[80vh] overflow-y-auto p-6 md:p-8 space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-black text-orange-600 uppercase tracking-wide">Detalle de la visita</h2>
              </div>

              {selectedVisit.place_photo_url ? (
                <div className="bg-white rounded-2xl border-2 border-orange-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black uppercase tracking-wide text-orange-600">Foto cargada</p>
                    <a href={selectedVisit.place_photo_url} download className="inline-flex items-center gap-2 text-xs font-black text-orange-700 hover:text-orange-900">
                      <Download className="w-4 h-4" />
                      Descargar
                    </a>
                  </div>
                  <img src={selectedVisit.place_photo_url} alt={selectedVisit.business_name} className="w-full h-[22rem] object-contain rounded-2xl border border-orange-100 bg-orange-50" />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-orange-200 p-8 text-center font-bold text-orange-700">
                  Este registro no tiene foto adjunta.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                <div className="bg-white rounded-xl border-2 border-orange-100 p-3">Establecimiento: <span className="font-bold text-gray-900">{selectedVisit.business_name || 'No registrado'}</span></div>
                <div className="bg-white rounded-xl border-2 border-orange-100 p-3">Propietario: <span className="font-bold text-gray-900">{selectedVisit.owner_name || 'No registrado'}</span></div>
                <div className="bg-white rounded-xl border-2 border-orange-100 p-3">WhatsApp: <span className="font-bold text-gray-900">{selectedVisit.whatsapp || 'No registrado'}</span></div>
                <div className="bg-white rounded-xl border-2 border-orange-100 p-3">Vendedor: <span className="font-bold text-gray-900">{selectedVisit.seller?.name || 'No registrado'}</span></div>
                <div className="bg-white rounded-xl border-2 border-orange-100 p-3 md:col-span-2">Fecha del registro: <span className="font-bold text-gray-900">{formatDateTime(selectedVisit.created_at)}</span></div>
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={() => setSelectedVisit(null)} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-5 py-2 font-bold">
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

SellerVisitsModule.displayName = 'SellerVisitsModule';

export default SellerVisitsModule;
