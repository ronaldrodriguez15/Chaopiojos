import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';
import { geocodeAddress } from '@/lib/geocoding';

const CACHE_KEY = 'adminMapEstablishmentGeocodes';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const piojologistIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const establishmentIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'hue-rotate-[120deg]',
});

const readGeocodeCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
};

const writeGeocodeCache = (cache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    // ignore storage errors
  }
};

const normalizeCoordinate = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const resolveEstablishmentAddress = (user) => (
  user?.managed_seller_referral?.address
  || user?.managedSellerReferral?.address
  || user?.address
  || ''
);

const resolveEstablishmentName = (user) => (
  user?.managed_seller_referral?.business_name
  || user?.managedSellerReferral?.business_name
  || user?.business_name
  || user?.name
);

const resolveEstablishmentLat = (user) => (
  user?.managed_seller_referral?.lat
  ?? user?.managedSellerReferral?.lat
  ?? user?.lat
);

const resolveEstablishmentLng = (user) => (
  user?.managed_seller_referral?.lng
  ?? user?.managedSellerReferral?.lng
  ?? user?.lng
);

const PiojologistMap = ({ piojologists = [] }) => {
  const [mapCenter, setMapCenter] = useState([4.7110, -74.0141]);
  const [mapItems, setMapItems] = useState([]);
  const [geocodingCount, setGeocodingCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const buildMapItems = async () => {
      const piojologistsData = piojologists
        .filter((user) => user.role === 'piojologa' && user.address)
        .map((user) => ({
          ...user,
          type: 'piojologa',
          displayName: user.name,
          displayAddress: user.address,
          lat: normalizeCoordinate(user.lat),
          lng: normalizeCoordinate(user.lng),
        }))
        .filter((user) => user.lat !== null && user.lng !== null);

      const establishmentUsers = piojologists
        .filter((user) => user.role === 'referido')
        .map((user) => ({
          ...user,
          type: 'establecimiento',
          displayName: resolveEstablishmentName(user),
          displayAddress: resolveEstablishmentAddress(user),
          lat: normalizeCoordinate(resolveEstablishmentLat(user)),
          lng: normalizeCoordinate(resolveEstablishmentLng(user)),
        }))
        .filter((user) => user.displayAddress);

      const cache = readGeocodeCache();
      let nextCache = { ...cache };
      let pendingGeocodes = 0;

      const establishmentsData = [];
      for (const establishment of establishmentUsers) {
        if (establishment.lat !== null && establishment.lng !== null) {
          establishmentsData.push(establishment);
          continue;
        }

        const cacheKey = establishment.displayAddress.trim().toLowerCase();
        const cached = nextCache[cacheKey];
        if (cached && Number.isFinite(Number(cached.lat)) && Number.isFinite(Number(cached.lng))) {
          establishmentsData.push({
            ...establishment,
            lat: Number(cached.lat),
            lng: Number(cached.lng),
          });
          continue;
        }

        pendingGeocodes += 1;
        if (isMounted) setGeocodingCount(pendingGeocodes);

        const coordinates = await geocodeAddress(establishment.displayAddress);
        pendingGeocodes -= 1;
        if (isMounted) setGeocodingCount(pendingGeocodes);

        if (coordinates) {
          nextCache[cacheKey] = coordinates;
          establishmentsData.push({
            ...establishment,
            lat: coordinates.lat,
            lng: coordinates.lng,
          });
        }
      }

      writeGeocodeCache(nextCache);

      const nextItems = [...piojologistsData, ...establishmentsData];
      if (!isMounted) return;

      setMapItems(nextItems);
      if (nextItems.length > 0) {
        setMapCenter([nextItems[0].lat, nextItems[0].lng]);
      }
    };

    buildMapItems();

    return () => {
      isMounted = false;
    };
  }, [piojologists]);

  if (mapItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl"
      >
        <div className="text-center p-8">
          <p className="text-4xl mb-4">🗺️</p>
          <p className="text-gray-600 font-bold text-lg">
            No hay ubicaciones fijas para mostrar
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Crea piojólogas o establecimientos con dirección para verlos en el mapa
          </p>
          {geocodingCount > 0 ? (
            <p className="text-cyan-600 text-sm font-bold mt-3">Localizando establecimientos...</p>
          ) : null}
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

        {mapItems.map((item) => (
          <Marker
            key={`${item.type}-${item.id}`}
            position={[item.lat, item.lng]}
            icon={item.type === 'establecimiento' ? establishmentIcon : piojologistIcon}
          >
            <Popup className="rounded-xl">
              <div className="p-2 min-w-[200px]">
                <h3 className={`font-bold text-lg mb-1 ${item.type === 'establecimiento' ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {item.type === 'establecimiento' ? '🏢' : '🦸'} {item.displayName}
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">Tipo:</span> {item.type === 'establecimiento' ? 'Establecimiento' : 'Piojóloga'}
                </p>
                {item.type === 'piojologa' ? (
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-semibold">Especialidad:</span> {item.specialty || 'No especificada'}
                  </p>
                ) : null}
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">Dirección:</span> {item.displayAddress}
                </p>
                <p className="text-xs text-gray-500 mb-1">
                  <span className="font-semibold">Coordenadas:</span> {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                </p>
                {item.type === 'piojologa' ? (
                  <p className="text-sm">
                    <span className="font-semibold">Estado:</span>
                    <span className={item.available ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                      {item.available ? 'Disponible' : 'No disponible'}
                    </span>
                  </p>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </motion.div>
  );
};

export default PiojologistMap;
