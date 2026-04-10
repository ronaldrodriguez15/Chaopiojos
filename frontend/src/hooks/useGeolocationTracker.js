import { useCallback, useEffect, useRef, useState } from 'react';
import { authService, geolocationService } from '@/lib/api';

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 30000,
};

const MIN_SEND_INTERVAL_MS = 15000;

const getPositionErrorStatus = (error) => {
  if (!error) return 'error';
  if (error.code === error.PERMISSION_DENIED) return 'denied';
  if (error.code === error.POSITION_UNAVAILABLE) return 'unavailable';
  if (error.code === error.TIMEOUT) return 'timeout';
  return 'error';
};

const getPositionErrorMessage = (status) => {
  const messages = {
    denied: 'El navegador tiene bloqueado el permiso de ubicación.',
    unavailable: 'No se pudo obtener la ubicación del dispositivo.',
    timeout: 'El navegador tardó demasiado en responder la ubicación.',
    unsupported: 'Este navegador no soporta geolocalización.',
    error: 'No se pudo leer la ubicación.',
  };
  return messages[status] || messages.error;
};

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const buildPayloadFromPosition = (position) => ({
  lat: toFiniteNumber(position.coords.latitude),
  lng: toFiniteNumber(position.coords.longitude),
  accuracy: toFiniteNumber(position.coords.accuracy),
  heading: toFiniteNumber(position.coords.heading),
  speed: toFiniteNumber(position.coords.speed),
  source: 'browser',
  permission_status: 'granted',
  reported_at: new Date(position.timestamp || Date.now()).toISOString(),
});

export function useGeolocationTracker(currentUser) {
  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(null);
  const watchIdRef = useRef(null);
  const lastSentMsRef = useRef(0);

  const canTrack = Boolean(
    currentUser
    && authService.isAuthenticated()
    && ['admin', 'piojologa', 'vendedor'].includes(currentUser.role)
  );

  const sendPayload = useCallback(async (payload, { force = false } = {}) => {
    if (!canTrack) return { success: false };
    const enrichedPayload = {
      ...payload,
      user_id: currentUser?.id,
      id: currentUser?.id,
      name: currentUser?.name,
      email: currentUser?.email,
      role: currentUser?.role,
    };

    const nowMs = Date.now();
    const hasCoordinates = enrichedPayload.lat !== null
      && typeof enrichedPayload.lat !== 'undefined'
      && enrichedPayload.lng !== null
      && typeof enrichedPayload.lng !== 'undefined';
    if (!force && hasCoordinates && nowMs - lastSentMsRef.current < MIN_SEND_INTERVAL_MS) {
      return { success: true, throttled: true };
    }

    if (hasCoordinates) {
      lastSentMsRef.current = nowMs;
    }

    const result = await geolocationService.update(enrichedPayload);
    if (result.success) {
      setLastSentAt(new Date().toISOString());
    }
    return result;
  }, [canTrack, currentUser]);

  const handleSuccess = useCallback((position, options = {}) => {
    setPermissionStatus('granted');
    setErrorMessage('');
    setIsRequesting(false);
    const payload = buildPayloadFromPosition(position);
    return sendPayload(payload, options);
  }, [sendPayload]);

  const handleError = useCallback((error) => {
    const status = getPositionErrorStatus(error);
    setPermissionStatus(status);
    setErrorMessage(getPositionErrorMessage(status));
    setIsRequesting(false);
    sendPayload({
      permission_status: status,
      source: 'browser',
      reported_at: new Date().toISOString(),
    }, { force: true });
  }, [sendPayload]);

  const startWatch = useCallback(() => {
    if (!canTrack || !navigator.geolocation || watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => handleSuccess(position),
      handleError,
      GEOLOCATION_OPTIONS
    );
  }, [canTrack, handleError, handleSuccess]);

  const requestLocation = useCallback(() => {
    if (!canTrack) return;
    if (!navigator.geolocation) {
      setPermissionStatus('unsupported');
      setErrorMessage(getPositionErrorMessage('unsupported'));
      sendPayload({
        permission_status: 'unsupported',
        source: 'browser',
        reported_at: new Date().toISOString(),
      }, { force: true });
      return;
    }

    setIsRequesting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await handleSuccess(position, { force: true });
        startWatch();
      },
      handleError,
      GEOLOCATION_OPTIONS
    );
  }, [canTrack, handleError, handleSuccess, sendPayload, startWatch]);

  useEffect(() => {
    if (!canTrack || !navigator.permissions?.query) return undefined;

    let permission;
    let isMounted = true;

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (!isMounted) return;
      permission = result;
      setPermissionStatus(result.state || 'prompt');
      permission.onchange = () => {
        setPermissionStatus(permission.state || 'prompt');
        if (permission.state === 'granted') {
          requestLocation();
        }
      };
    }).catch(() => {
      setPermissionStatus('prompt');
    });

    return () => {
      isMounted = false;
      if (permission) permission.onchange = null;
    };
  }, [canTrack, requestLocation]);

  useEffect(() => {
    if (!canTrack) return undefined;

    requestLocation();

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [canTrack, requestLocation]);

  return {
    permissionStatus,
    errorMessage,
    isRequesting,
    lastSentAt,
    requestLocation,
  };
}
