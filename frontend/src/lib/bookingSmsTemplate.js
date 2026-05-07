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

export const extractWhatsappRecommendations = (template) => {
  const source = (typeof template === 'string' && template.trim())
    ? template
    : DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE;

  const lines = source.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /prepararte|recomend/i.test(line));
  if (startIndex === -1) {
    return source === DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE
      ? source.trim()
      : extractWhatsappRecommendations(DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE);
  }

  const endIndex = lines.findIndex((line, index) => (
    index > startIndex && /confirmo mi asistencia|gracias por confiar/i.test(line)
  ));

  return lines
    .slice(startIndex, endIndex === -1 ? lines.length : endIndex)
    .map((line) => line.trimEnd())
    .filter((line, index, list) => {
      const clean = line.trim();
      if (!clean) return true;
      if (/^-{3,}$/.test(clean)) {
        const previous = list[index - 1]?.trim();
        const next = list[index + 1]?.trim();
        return Boolean(previous && next);
      }
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const buildBookingConfirmationReminderMessage = (template, data = {}) => {
  const recommendations = extractWhatsappRecommendations(template);
  const clientName = data.clientName || 'cliente';
  const fecha = data.fecha || '';

  return [
    `Hola, buen dia ${clientName}, nos gustaria confirmar tu agendamiento para el dia ${fecha}, recuerda estas recomendaciones:`,
    '',
    recommendations
  ].join('\n').trim();
};
