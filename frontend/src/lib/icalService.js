/**
 * Servicio para descargar y parsear eventos de un feed iCal
 */

// URL del proxy en el backend
import { API_URL } from '@/lib/config';

/**
 * Descargar eventos del feed iCal
 * @param {string} icalUrl - URL del feed iCal
 * @returns {Promise<Array>} Array de eventos parseados
 */
export const fetchICalEvents = async (icalUrl) => {
  try {
    // Usar el proxy del backend para evitar problemas de CORS
    const proxyUrl = `${API_URL}/ical-proxy?url=${encodeURIComponent(icalUrl)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'Accept': 'text/calendar'
      }
    });

    if (!response.ok) {
      return [];
    }

    const icalText = await response.text();
    const events = parseICalEvents(icalText);
    return events;
  } catch (error) {
    // Error silencioso - retornar array vacío
    return [];
  }
};

/**
 * Parsear el contenido de un iCal
 * @param {string} icalText - Contenido del archivo iCal
 * @returns {Array} Array de eventos
 */
export const parseICalEvents = (icalText) => {
  const events = [];
  
  try {
    // Expresión regular para extraer eventos VEVENT
    const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
    let match;

    while ((match = eventRegex.exec(icalText)) !== null) {
      const eventText = match[1];
      const event = parseVEvent(eventText);
      if (event) {
        events.push(event);
      }
    }
  } catch (error) {
    // Error silencioso
  }

  return events;
};

/**
 * Parsear un evento VEVENT individual
 * @param {string} eventText - Contenido del VEVENT
 * @returns {Object|null} Objeto evento parseado o null
 */
const parseVEvent = (eventText) => {
  try {
    const event = {
      id: extractField(eventText, 'UID'),
      title: extractField(eventText, 'SUMMARY'),
      description: extractField(eventText, 'DESCRIPTION'),
      startDate: parseICalDate(extractField(eventText, 'DTSTART')),
      endDate: parseICalDate(extractField(eventText, 'DTEND')),
      location: extractField(eventText, 'LOCATION'),
      status: extractField(eventText, 'STATUS') || 'CONFIRMED'
    };

    if (!event.title || !event.startDate) {
      return null;
    }

    return event;
  } catch (error) {
    console.error('Error parseando VEVENT:', error);
    return null;
  }
};

/**
 * Extraer un campo del texto iCal
 * @param {string} text - Texto iCal
 * @param {string} fieldName - Nombre del campo
 * @returns {string} Valor del campo
 */
const extractField = (text, fieldName) => {
  const regex = new RegExp(`${fieldName}(?:;[^:]*)?:([^\r\n]*)`);
  const match = text.match(regex);
  if (match && match[1]) {
    // Desescapar caracteres especiales iCal
    return match[1]
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\');
  }
  return null;
};

/**
 * Parsear fecha en formato iCal (YYYYMMDDTHHMMSS o similar)
 * @param {string} icalDate - Fecha en formato iCal
 * @returns {Date|null} Objeto Date o null
 */
const parseICalDate = (icalDate) => {
  if (!icalDate) return null;

  try {
    // Formato: 20260116T100000Z o 20260116
    const dateOnly = /^\d{8}$/.test(icalDate);
    
    let year, month, day, hours = 0, minutes = 0;

    if (dateOnly) {
      // Solo fecha: YYYYMMDD
      year = parseInt(icalDate.substring(0, 4));
      month = parseInt(icalDate.substring(4, 6));
      day = parseInt(icalDate.substring(6, 8));
    } else {
      // Fecha y hora: YYYYMMDDTHHMMSS o YYYYMMDDTHHMMSSZ
      year = parseInt(icalDate.substring(0, 4));
      month = parseInt(icalDate.substring(4, 6));
      day = parseInt(icalDate.substring(6, 8));
      
      if (icalDate.includes('T')) {
        const timeStart = icalDate.indexOf('T') + 1;
        hours = parseInt(icalDate.substring(timeStart, timeStart + 2)) || 0;
        minutes = parseInt(icalDate.substring(timeStart + 2, timeStart + 4)) || 0;
      }
    }

    return new Date(year, month - 1, day, hours, minutes);
  } catch (error) {
    return null;
  }
};

/**
 * Convertir eventos iCal a formato de citas local
 * @param {Array} icalEvents - Eventos del iCal
 * @returns {Array} Citas en formato local
 */
export const convertICalEventsToAppointments = (icalEvents) => {
  return icalEvents.map(event => {
    const date = event.startDate;
    const pad = (n) => (n < 10 ? '0' + n : n);
    
    return {
      id: `external-${event.id}`,
      clientName: event.title,
      serviceType: 'Cita Externa',
      description: event.description || '',
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
      piojologistId: null,
      piojologistName: event.location || 'Cita Booked.net',
      status: 'confirmed',
      isExternal: true,
      source: 'ical'
    };
  });
};
