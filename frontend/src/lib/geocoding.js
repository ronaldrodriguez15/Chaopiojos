/**
 * Servicio de geocodificación usando OpenStreetMap Nominatim
 * Convierte direcciones en coordenadas (lat, lng)
 */

const NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocodifica una dirección a coordenadas
 * @param {string} address - La dirección a geocodificar
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export const geocodeAddress = async (address) => {
  if (!address || address.trim() === '') {
    return null;
  }

  try {
    const response = await fetch(
      `${NOMINATIM_API_URL}?q=${encodeURIComponent(address)}&format=json&limit=1`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      console.error('Error en geocodificación:', response.statusText);
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      };
    }

    console.warn(`No se encontraron coordenadas para: ${address}`);
    return null;
  } catch (error) {
    console.error('Error al geocodificar:', error);
    return null;
  }
};

/**
 * Geocodifica múltiples direcciones (con rate limiting)
 * @param {Array<string>} addresses - Array de direcciones
 * @returns {Promise<Array<{address: string, coordinates: {lat: number, lng: number} | null}>>}
 */
export const geocodeBatch = async (addresses) => {
  const results = [];

  for (const address of addresses) {
    const coordinates = await geocodeAddress(address);
    results.push({ address, coordinates });
    // Rate limiting para no sobrecargar la API (esperar 1 segundo entre peticiones)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
};
