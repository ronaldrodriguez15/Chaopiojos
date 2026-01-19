import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';

// Fix for marker icons in Leaflet with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icon for piojologists
const piojologistIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const PiojologistMap = ({ piojologists = [] }) => {
  const [mapCenter, setMapCenter] = useState([4.7110, -74.0141]); // Bogotá center
  const [piojologistsWithCoords, setPiojologistsWithCoords] = useState([]);

  useEffect(() => {
    // Filter piojologists y usar sus coordenadas reales (si existen)
    const piojologistsData = piojologists
      .filter(p => p.role === 'piojologist' && p.address)
      .filter(p => p.lat && p.lng) // Solo mostrar si tienen coordenadas geocodificadas
      .map(p => ({
        ...p,
        coordinates: { lat: p.lat, lng: p.lng }
      }));
    
    setPiojologistsWithCoords(piojologistsData);

    // Si hay piojólogas, centrar el mapa en la primera
    if (piojologistsData.length > 0) {
      setMapCenter([piojologistsData[0].coordinates.lat, piojologistsData[0].coordinates.lng]);
    }
  }, [piojologists]);

  if (piojologistsWithCoords.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl"
      >
        <div className="text-center p-8">
          <p className="text-4xl mb-4">🗺️</p>
          <p className="text-gray-600 font-bold text-lg">
            No hay piojólogas con ubicación
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Crea piojólogas con dirección para verlas en el mapa
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-full rounded-2xl overflow-hidden border-4 border-blue-100 shadow-lg"
    >
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {piojologistsWithCoords.map(piojologist => (
          <Marker
            key={piojologist.id}
            position={[piojologist.coordinates.lat, piojologist.coordinates.lng]}
            icon={piojologistIcon}
          >
            <Popup className="rounded-xl">
              <div className="p-2 min-w-[200px]">
                <h3 className="font-bold text-lg text-blue-600 mb-1">
                  🦸 {piojologist.name}
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">Especialidad:</span> {piojologist.specialty}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">Dirección:</span> {piojologist.address}
                </p>
                <p className="text-xs text-gray-500 mb-1">
                  <span className="font-semibold">Coordenadas:</span> {piojologist.coordinates.lat.toFixed(4)}, {piojologist.coordinates.lng.toFixed(4)}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Estado:</span> 
                  <span className={piojologist.available ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                    {piojologist.available ? '✅ Disponible' : '❌ No disponible'}
                  </span>
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </motion.div>
  );
};

export default PiojologistMap;
