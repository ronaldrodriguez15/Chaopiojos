import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, MessageCircle, Phone, Search, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Pagination from './Pagination';
import StatsHighlightCard from '@/components/StatsHighlightCard';
import { buildBookingConfirmationReminderMessage } from '@/lib/bookingSmsTemplate';
import { formatTime12Hour } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const normalize = (value) => String(value || '').trim().toLowerCase();

const getAppointmentDate = (appointment) => appointment?.date || appointment?.fecha || '';

const getAppointmentTime = (appointment) => appointment?.time || appointment?.hora || '';

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(`${String(value).split('T')[0]}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const buildWhatsappUrl = (phone, message) => {
  const clean = String(phone || '').replace(/\D/g, '');
  if (!clean) return '';
  const number = clean.startsWith('57') ? clean : `57${clean}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
};

const ConfirmationsModule = ({ appointments = [], piojologists = [], whatsappTemplate = '' }) => {
  const [search, setSearch] = useState('');
  const [piojologistFilter, setPiojologistFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const piojologistById = useMemo(() => (
    new Map(piojologists.map((user) => [Number(user.id), user]))
  ), [piojologists]);

  const assignedAppointments = useMemo(() => {
    const unique = new Map();

    appointments
      .filter((appointment) => appointment?.piojologistId || appointment?.piojologist_id)
      .forEach((appointment) => {
        const key = appointment.backendId || appointment.bookingId || appointment.id;
        if (!unique.has(key)) unique.set(key, appointment);
      });

    return [...unique.values()].sort((a, b) => {
      const dateA = `${getAppointmentDate(a)} ${getAppointmentTime(a) || '00:00'}`;
      const dateB = `${getAppointmentDate(b)} ${getAppointmentTime(b) || '00:00'}`;
      return dateB.localeCompare(dateA);
    });
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    const searchValue = normalize(search);

    return assignedAppointments.filter((appointment) => {
      const piojologistId = Number(appointment.piojologistId || appointment.piojologist_id);
      const piojologist = piojologistById.get(piojologistId);
      const piojologistName = appointment.piojologistName || piojologist?.name || '';
      const matchesPiojologist = piojologistFilter === 'all' || String(piojologistId) === piojologistFilter;
      const haystack = [
        appointment.clientName,
        appointment.serviceType,
        appointment.whatsapp,
        appointment.barrio,
        appointment.direccion,
        piojologistName,
      ].map(normalize).join(' ');

      return matchesPiojologist && (!searchValue || haystack.includes(searchValue));
    });
  }, [assignedAppointments, piojologistById, piojologistFilter, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [piojologistFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAppointments = filteredAppointments.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const visibleStart = filteredAppointments.length === 0 ? 0 : ((safePage - 1) * ITEMS_PER_PAGE) + 1;
  const visibleEnd = Math.min(safePage * ITEMS_PER_PAGE, filteredAppointments.length);

  const selectedPiojologistId = Number(selectedAppointment?.piojologistId || selectedAppointment?.piojologist_id);
  const selectedPiojologist = piojologistById.get(selectedPiojologistId);
  const selectedDate = formatDate(getAppointmentDate(selectedAppointment));
  const selectedMessage = selectedAppointment
    ? buildBookingConfirmationReminderMessage(whatsappTemplate, {
      clientName: selectedAppointment.clientName,
      fecha: selectedDate,
    })
    : '';
  const whatsappUrl = selectedAppointment ? buildWhatsappUrl(selectedAppointment.whatsapp, selectedMessage) : '';

  return (
    <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-teal-100 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-gray-800">Confirmaciones</h3>
          <p className="text-sm font-bold text-gray-500 mt-1">Agendamientos asignados a una piojóloga, listos para confirmar con el cliente.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatsHighlightCard label="Asignados" value={assignedAppointments.length} icon={CalendarCheck} tone="from-teal-50 to-teal-100 border-teal-200 text-teal-700" />
        <StatsHighlightCard label="Filtrados" value={filteredAppointments.length} icon={Search} tone="from-cyan-50 to-cyan-100 border-cyan-200 text-cyan-700" />
        <StatsHighlightCard label="Piojólogas" value={new Set(assignedAppointments.map((item) => item.piojologistId || item.piojologist_id).filter(Boolean)).size} icon={UserCheck} tone="from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700" />
      </div>

      <div className="rounded-[2rem] border-4 border-teal-100 bg-teal-50/70 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-teal-700 mb-2">Buscar</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-2xl border-2 border-teal-200 bg-white p-3 font-bold text-gray-700 outline-none focus:border-teal-400"
              placeholder="Cliente, WhatsApp, servicio, barrio..."
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-teal-700 mb-2">Piojóloga</label>
            <select
              value={piojologistFilter}
              onChange={(event) => setPiojologistFilter(event.target.value)}
              className="w-full rounded-2xl border-2 border-teal-200 bg-white p-3 font-bold text-gray-700 outline-none focus:border-teal-400"
            >
              <option value="all">Todas</option>
              {piojologists.map((piojologist) => (
                <option key={piojologist.id} value={String(piojologist.id)}>{piojologist.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="rounded-[2rem] border-4 border-dashed border-teal-200 bg-teal-50 p-10 text-center font-bold text-teal-700">
          No hay agendamientos asignados que coincidan con los filtros actuales.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
            <p className="text-sm font-bold text-gray-600">Mostrando {visibleStart}-{visibleEnd} de {filteredAppointments.length} agendamientos</p>
            <p className="text-xs font-black uppercase tracking-wide text-teal-600">Pagina {safePage}</p>
          </div>

          <div className="overflow-x-auto rounded-[2rem] border-4 border-teal-100">
            <table className="min-w-[980px] w-full bg-white text-sm">
              <thead className="bg-teal-50 text-teal-800">
                <tr className="text-left">
                  <th className="px-4 py-3 font-black">Cliente</th>
                  <th className="px-4 py-3 font-black">Fecha</th>
                  <th className="px-4 py-3 font-black">Hora</th>
                  <th className="px-4 py-3 font-black">Servicio</th>
                  <th className="px-4 py-3 font-black">Piojóloga</th>
                  <th className="px-4 py-3 font-black">WhatsApp</th>
                  <th className="px-4 py-3 font-black text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100">
                {paginatedAppointments.map((appointment) => {
                  const piojologistId = Number(appointment.piojologistId || appointment.piojologist_id);
                  const piojologist = piojologistById.get(piojologistId);
                  const piojologistName = appointment.piojologistName || piojologist?.name || 'Sin nombre';

                  return (
                    <tr key={`${appointment.id}-${getAppointmentDate(appointment)}-${getAppointmentTime(appointment)}`} className="hover:bg-teal-50/60">
                      <td className="px-4 py-3 font-black text-gray-800">{appointment.clientName || 'Sin cliente'}</td>
                      <td className="px-4 py-3 font-bold text-gray-700">{formatDate(getAppointmentDate(appointment))}</td>
                      <td className="px-4 py-3 font-bold text-gray-700">{formatTime12Hour(getAppointmentTime(appointment)) || 'Sin hora'}</td>
                      <td className="px-4 py-3 font-bold text-gray-700">{appointment.serviceType || 'Sin servicio'}</td>
                      <td className="px-4 py-3 font-bold text-gray-700">{piojologistName}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{appointment.whatsapp || 'No registrado'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          onClick={() => setSelectedAppointment(appointment)}
                          className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl px-4 py-2 font-black"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Enviar mensaje
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={safePage}
            totalItems={filteredAppointments.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            colorScheme="cyan"
          />
        </div>
      )}

      <Dialog open={Boolean(selectedAppointment)} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-teal-300 p-0 overflow-hidden sm:max-w-2xl bg-teal-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Mensaje de confirmación</DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="max-h-[80vh] overflow-y-auto p-6 md:p-8 space-y-5">
              <div>
                <p className="text-xs font-black text-teal-600 uppercase tracking-wide">Confirmación</p>
                <h2 className="text-2xl font-black text-gray-800">Mensaje para {selectedAppointment.clientName || 'cliente'}</h2>
                <p className="text-sm font-bold text-gray-500 mt-1">
                  {selectedDate} · {formatTime12Hour(getAppointmentTime(selectedAppointment)) || 'Sin hora'} · {selectedPiojologist?.name || selectedAppointment.piojologistName || 'Piojóloga asignada'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-bold text-gray-700">
                <div className="bg-white rounded-2xl border-2 border-teal-100 p-3">
                  <p className="text-xs font-black uppercase text-teal-600 mb-1">Cliente</p>
                  <p>{selectedAppointment.clientName || 'Sin cliente'}</p>
                </div>
                <div className="bg-white rounded-2xl border-2 border-teal-100 p-3">
                  <p className="text-xs font-black uppercase text-teal-600 mb-1">WhatsApp</p>
                  <p>{selectedAppointment.whatsapp || 'No registrado'}</p>
                </div>
              </div>

              <textarea
                readOnly
                value={selectedMessage}
                className="w-full min-h-[360px] rounded-2xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none resize-y"
              />

              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigator.clipboard?.writeText(selectedMessage)}
                  className="border-2 border-teal-200 text-teal-700 hover:bg-teal-100 font-black rounded-xl px-5"
                >
                  Copiar mensaje
                </Button>
                <Button
                  type="button"
                  disabled={!whatsappUrl}
                  onClick={() => window.open(whatsappUrl, '_blank')}
                  className="bg-green-500 hover:bg-green-600 text-white font-black rounded-xl px-5 disabled:opacity-60"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Abrir WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default React.memo(ConfirmationsModule);
