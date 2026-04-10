import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Activity, Loader, LocateFixed, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authService, geolocationService } from '@/lib/api';
import { GEOLOCATION_WS_URL } from '@/lib/config';

const ROLE_LABELS = {
  piojologa: 'Piojóloga',
  vendedor: 'Vendedor',
};

const ROLE_COLORS = {
  piojologa: '#06b6d4',
  vendedor: '#22c55e',
};

const ROLE_INITIALS = {
  piojologa: 'P',
  vendedor: 'V',
};

const DEFAULT_CENTER = [4.711, -74.0141];

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getFreshness = (location) => {
  const lastSeen = toDate(location.last_seen_at || location.reported_at || location.updated_at);
  if (!lastSeen) return { label: 'Sin reporte', className: 'bg-gray-100 text-gray-600', isLive: false };

  const diffMinutes = (Date.now() - lastSeen.getTime()) / 60000;
  if (diffMinutes <= 2) return { label: 'En vivo', className: 'bg-green-100 text-green-700', isLive: true };
  if (diffMinutes <= 15) return { label: 'Reciente', className: 'bg-amber-100 text-amber-700', isLive: false };
  return { label: 'Sin señal', className: 'bg-rose-100 text-rose-700', isLive: false };
};

const formatDateTime = (value) => {
  const date = toDate(value);
  if (!date) return 'Sin reporte';
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const createRoleIcon = (role, isLive) => {
  const color = ROLE_COLORS[role] || '#64748b';
  const initial = ROLE_INITIALS[role] || '?';
  const pulse = isLive ? 'box-shadow: 0 0 0 8px rgba(34,197,94,0.18);' : 'box-shadow: 0 6px 14px rgba(15,23,42,0.22);';

  return L.divIcon({
    className: 'geolocation-role-marker',
    html: `<div style="width:34px;height:34px;border-radius:999px;background:${color};border:3px solid white;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;${pulse}">${initial}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
};

const FitMapBounds = ({ locations }) => {
  const map = useMap();

  useEffect(() => {
    const points = locations
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      .map((item) => [item.lat, item.lng]);

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }

    map.fitBounds(points, { padding: [36, 36] });
  }, [locations, map]);

  return null;
};

const upsertLocation = (current, incoming) => {
  const next = Array.isArray(incoming) ? incoming : [incoming];
  const byId = new Map(current.map((item) => [item.user_id || item.id, item]));
  next.forEach((item) => {
    if (!item) return;
    const key = item.user_id || item.id;
    if (!key) return;
    byId.set(key, { ...byId.get(key), ...item });
  });
  return Array.from(byId.values());
};

const GeolocationModule = () => {
  const [locations, setLocations] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wsStatus, setWsStatus] = useState(GEOLOCATION_WS_URL ? 'connecting' : 'disabled');
  const [errorMessage, setErrorMessage] = useState('');
  const wsRef = useRef(null);

  const loadLocations = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const result = await geolocationService.getAll();

    if (result.success) {
      setLocations(result.locations || []);
      setErrorMessage('');
    } else {
      setErrorMessage(result.message || 'No se pudieron cargar las ubicaciones');
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => loadLocations({ silent: true }), 10000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!GEOLOCATION_WS_URL || typeof WebSocket === 'undefined') {
      setWsStatus('disabled');
      return undefined;
    }

    const token = authService.getToken();
    const separator = GEOLOCATION_WS_URL.includes('?') ? '&' : '?';
    const url = token ? `${GEOLOCATION_WS_URL}${separator}token=${encodeURIComponent(token)}` : GEOLOCATION_WS_URL;
    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onopen = () => setWsStatus('connected');
    socket.onerror = () => setWsStatus('error');
    socket.onclose = () => {
      setWsStatus('closed');
      wsRef.current = null;
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const payload = message.payload || message.location || message;
        setLocations((current) => upsertLocation(current, payload));
      } catch (error) {
        // Ignore malformed WebSocket payloads; polling remains active.
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  const normalizedLocations = useMemo(() => (
    locations
      .filter((location) => location.role !== 'referido')
      .map((location) => ({
        ...location,
        lat: location.lat === null || typeof location.lat === 'undefined' ? null : Number(location.lat),
        lng: location.lng === null || typeof location.lng === 'undefined' ? null : Number(location.lng),
      }))
  ), [locations]);

  const filteredLocations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return normalizedLocations.filter((location) => {
      if (roleFilter !== 'all' && location.role !== roleFilter) return false;
      if (!term) return true;

      const haystack = [
        location.name,
        location.business_name,
        location.email,
        location.address,
        ROLE_LABELS[location.role],
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(term);
    });
  }, [normalizedLocations, roleFilter, search]);

  const mappableLocations = filteredLocations.filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng));
  const liveCount = normalizedLocations.filter((location) => getFreshness(location).isLive).length;
  const pendingPermissionCount = normalizedLocations.filter((location) => location.permission_status && location.permission_status !== 'granted').length;
  const wsConnected = wsStatus === 'connected';

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-4 md:p-6 shadow-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
              <LocateFixed className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-700">Módulo</p>
              <h3 className="text-2xl font-black text-gray-800">Geolocalización</h3>
              <p className="text-sm font-bold text-gray-500">
                Ubicación en tiempo real de piojólogas y vendedores.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <div className="rounded-xl border-2 border-green-200 bg-green-50 px-3 py-2 text-sm font-black text-green-700">
              {liveCount} en vivo
            </div>
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">
              {pendingPermissionCount} con permiso pendiente
            </div>
            <div className={`rounded-xl border-2 px-3 py-2 text-sm font-black ${wsConnected ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
              {wsConnected ? <Wifi className="mr-1 inline h-4 w-4" /> : <WifiOff className="mr-1 inline h-4 w-4" />}
              {wsConnected ? 'WebSocket activo' : 'WebSocket en espera'}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full rounded-xl border-2 border-cyan-100 bg-white pl-10 pr-4 text-sm font-bold text-gray-700 outline-none focus:border-cyan-400"
              placeholder="Buscar por nombre, correo o dirección"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="h-12 rounded-xl border-2 border-cyan-100 bg-white px-3 text-sm font-black text-gray-700 outline-none focus:border-cyan-400"
          >
            <option value="all">Todos</option>
            <option value="piojologa">Piojólogas</option>
            <option value="vendedor">Vendedores</option>
          </select>
          <Button
            type="button"
            onClick={() => loadLocations({ silent: true })}
            disabled={loading || refreshing}
            className="h-12 rounded-xl bg-cyan-500 font-black text-white hover:bg-cyan-600"
          >
            {refreshing ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border-2 border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="h-[420px] overflow-hidden rounded-2xl border-4 border-cyan-100 bg-cyan-50 shadow-xl md:h-[620px]">
          {loading ? (
            <div className="flex h-full items-center justify-center text-cyan-700">
              <Loader className="mr-2 h-6 w-6 animate-spin" />
              <span className="font-black">Cargando ubicaciones...</span>
            </div>
          ) : mappableLocations.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <LocateFixed className="mx-auto mb-3 h-10 w-10 text-cyan-700" />
                <p className="font-black text-gray-800">No hay ubicaciones para mostrar en el mapa</p>
                <p className="mt-1 text-sm font-bold text-gray-500">Cuando los usuarios acepten el permiso aparecerán aquí.</p>
              </div>
            </div>
          ) : (
            <MapContainer center={DEFAULT_CENTER} zoom={12} className="h-full w-full" style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitMapBounds locations={mappableLocations} />
              {mappableLocations.map((location) => {
                const freshness = getFreshness(location);
                return (
                  <Marker
                    key={`${location.user_id}-${location.last_seen_at || location.updated_at || 'profile'}`}
                    position={[location.lat, location.lng]}
                    icon={createRoleIcon(location.role, freshness.isLive)}
                  >
                    <Popup>
                      <div className="min-w-[220px] space-y-2 p-1">
                        <div>
                          <p className="text-base font-black text-gray-900">{location.business_name || location.name}</p>
                          <p className="text-xs font-bold text-gray-500">{ROLE_LABELS[location.role] || location.role}</p>
                        </div>
                        <p className="text-xs font-bold text-gray-700">{location.email}</p>
                        {location.address ? <p className="text-xs font-bold text-gray-600">{location.address}</p> : null}
                        <p className="text-xs font-bold text-gray-600">
                          Último reporte: {formatDateTime(location.last_seen_at || location.reported_at || location.updated_at)}
                        </p>
                        {location.accuracy ? (
                          <p className="text-xs font-bold text-gray-600">Precisión: {Math.round(location.accuracy)} m</p>
                        ) : null}
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${freshness.className}`}>
                          {freshness.label}
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
        </div>

        <div className="max-h-[620px] overflow-y-auto rounded-2xl border-4 border-cyan-100 bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-black text-gray-800">Usuarios rastreados</p>
            <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-black text-cyan-700">{filteredLocations.length}</span>
          </div>

          <div className="space-y-3">
            {filteredLocations.map((location) => {
              const freshness = getFreshness(location);
              const hasCoordinates = Number.isFinite(location.lat) && Number.isFinite(location.lng);

              return (
                <div key={location.user_id || location.id} className="rounded-2xl border-2 border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-900">{location.business_name || location.name}</p>
                      <p className="text-xs font-bold text-gray-500">{ROLE_LABELS[location.role] || location.role}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${freshness.className}`}>
                      {freshness.label}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-xs font-bold text-gray-600">
                    <p>{hasCoordinates ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'Sin coordenadas'}</p>
                    <p>Permiso: {location.permission_status || 'sin reporte'}</p>
                    <p>Último reporte: {formatDateTime(location.last_seen_at || location.reported_at || location.updated_at)}</p>
                    {location.has_live_location || location.source === 'browser' ? (
                      <p className="flex items-center text-green-700"><Activity className="mr-1 h-3 w-3" /> Ubicación del navegador</p>
                    ) : (
                      <p>Fuente: {location.source === 'profile' ? 'dirección del perfil' : 'sin fuente'}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {!filteredLocations.length ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center text-sm font-bold text-gray-500">
                No hay resultados con los filtros actuales.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-800">
        OpenStreetMap activo. WebSocket disponible cuando exista una URL configurada; respaldo automático por API cada 10 segundos.
      </div>
    </div>
  );
};

export default GeolocationModule;
