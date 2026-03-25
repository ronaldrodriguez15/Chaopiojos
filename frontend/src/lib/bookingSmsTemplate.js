import { formatTime12Hour } from '@/lib/utils';

export const BUSINESS_WHATSAPP_NUMBER = '3227932394';
export const BUSINESS_WHATSAPP_API_NUMBER = '573227932394';

export const DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE = [
  '*RESERVA CONFIRMADA* ✅',
  '',
  '*Chao Piojos* 🦸',
  '',
  'Nombre: {clientName}',
  'Fecha: {fecha}',
  'Hora: {hora}',
  'Dirección: {direccion}',
  '{detailsLine}',
  'Barrio: {barrio}',
  '',
  'Personas: {numPersonas}',
  'Edad: {edad}',
  '{servicesList}',
  '',
  '*Total: {total}* 💰',
  '',
  '-------------------',
  '',
  '*¿Dudas o cambios?* 📱',
  'Escríbenos al WhatsApp {businessWhatsapp}',
  '',
  '-------------------',
  '',
  '*Cómo prepararte:* ✨',
  '',
  '- Cabello seco, limpio y sin productos',
  '- Cabello desenredado',
  '- No aplicar tratamientos antipiojos antes',
  '- Ten un espacio cómodo y una toalla limpia',
  '- Informa si hay alergias',
  '- El procedimiento toma entre 30 y 60 minutos',
  '- Menores deben estar acompañados por un adulto',
  '',
  '-------------------',
  '',
  '*Cuidados después:* 🏡',
  '',
  '- Lava el cabello después de la limpieza',
  '- Cambia ropa de cama y pijamas de los últimos 3 días',
  '- Lava y desinfecta peines, cepillos, ligas, gorras',
  '- Evita compartir objetos de cabeza',
  '- Aspira sillones, almohadas, colchones',
  '- Haz revisiones semanales en casa',
  '- Viste al niño con ropa limpia tras la limpieza',
  '',
  '-------------------',
  '',
  'Confirmo mi asistencia ✅',
  'Gracias por confiar en Chao Piojos 💚'
].join('\n');

export const SMS_TEMPLATE_VARIABLES = [
  '{clientName}',
  '{fecha}',
  '{hora}',
  '{direccion}',
  '{detailsLine}',
  '{barrio}',
  '{numPersonas}',
  '{edad}',
  '{servicesList}',
  '{total}',
  '{businessWhatsapp}'
];

export const buildBookingWhatsappMessage = (template, data = {}) => {
  const source = (typeof template === 'string' && template.trim())
    ? template
    : DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE;

  return source
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
      const value = data[key];
      if (value === null || value === undefined) return '';
      if (key === 'hora') return formatTime12Hour(value);
      return String(value);
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
