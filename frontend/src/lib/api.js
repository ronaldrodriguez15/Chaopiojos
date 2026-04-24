import axios from 'axios';
import { API_URL } from '@/lib/config';
import { DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE } from '@/lib/bookingSmsTemplate';
import { DEFAULT_TERMS_AND_CONDITIONS } from '@/lib/termsConditions';

// Crear instancia de axios con configuración
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

const setStoredCurrentUser = (user) => {
  localStorage.setItem('current_user', JSON.stringify(user));
};

const clearStoredSession = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('current_user');
};

// Interceptor para agregar el token a cada petición
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const hasToken = !!localStorage.getItem('auth_token');
    const message = error.response?.data?.message || '';

    // Evita redirigir en intentos de login fallidos; solo actúa cuando hay sesión previa
    if (status === 401 && hasToken && !requestUrl.includes('/login')) {
      clearStoredSession();
      window.location.href = '/';
    }

    if (status === 403 && hasToken && typeof message === 'string' && message.toLowerCase().includes('inactiva')) {
      clearStoredSession();
      window.location.href = '/';
    }

    return Promise.reject(error);
  }
);

// Servicios de autenticación
export const authService = {
  async login(email, password) {
    try {
      const response = await api.post('/login', { 
        email: email, 
        password: password 
      });

      const contentType = response.headers?.['content-type'] || '';
      if (!contentType.includes('application/json')) {
        return { 
          success: false, 
          message: 'Respuesta inesperada del servidor (no JSON). Revisa la URL del backend y el hosting.' 
        };
      }

      const { token, user } = response.data || {};

      if (!token || !user) {
        return { 
          success: false, 
          message: 'Respuesta inválida del servidor. No se recibió token/usuario.' 
        };
      }
      
      // Guardar token y usuario en localStorage
      localStorage.setItem('auth_token', token);
      setStoredCurrentUser(user);
      
      return { success: true, user, token };
    } catch (error) {
      console.error('Login error:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Error al iniciar sesión' 
      };
    }
  },

  async logout() {
    try {
      await api.post('/logout');
      clearStoredSession();
      return { success: true };
    } catch (error) {
      // Limpiar localStorage de todas formas
      clearStoredSession();
      return { success: true };
    }
  },

  async me() {
    try {
      const response = await api.get('/me');
      return { success: true, user: response.data.user };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al obtener usuario' 
      };
    }
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('current_user');
    if (!userStr || userStr === 'undefined' || userStr === 'null') {
      return null;
    }
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.warn('current_user no es JSON válido, limpiando storage');
      localStorage.removeItem('current_user');
      return null;
    }
  },

  getToken() {
    return localStorage.getItem('auth_token');
  },

  setCurrentUser(user) {
    setStoredCurrentUser(user);
  },

  clearSession() {
    clearStoredSession();
  },

  isAuthenticated() {
    return !!this.getToken();
  }
};

// Servicios de usuarios
export const userService = {
  async getAll() {
    try {
      const response = await api.get('/users');
      return { success: true, users: response.data.users };
    } catch (error) {
      console.error('Error obteniendo usuarios:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al obtener usuarios' 
      };
    }
  },

  async create(userData) {
    try {
      const response = await api.post('/users', userData);
      return { success: true, user: response.data.user };
    } catch (error) {
      console.error('Error creando usuario:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al crear usuario',
        errors: error.response?.data?.errors
      };
    }
  },

  async update(userId, userData) {
    try {
      const response = await api.put(`/users/${userId}`, userData);
      return { success: true, user: response.data.user };
    } catch (error) {
      console.error('Error actualizando usuario:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al actualizar usuario',
        errors: error.response?.data?.errors
      };
    }
  },

  async delete(userId) {
    try {
      const response = await api.delete(`/users/${userId}`);
      return { success: true, message: response.data.message };
    } catch (error) {
      console.error('Error eliminando usuario:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al eliminar usuario' 
      };
    }
  },

  async getById(userId) {
    try {
      const response = await api.get(`/users/${userId}`);
      return { success: true, user: response.data.user };
    } catch (error) {
      console.error('Error obteniendo usuario:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al obtener usuario' 
      };
    }
  },

  async regenerateReferralCode(userId) {
    try {
      const response = await api.post(`/regenerate-referral-code/${userId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error regenerando código:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al regenerar código' 
      };
    }
  }
};

export const profileService = {
  async get() {
    try {
      const response = await api.get('/profile');
      return { success: true, user: response.data.user };
    } catch (error) {
      console.error('Error obteniendo perfil:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener perfil'
      };
    }
  },

  async update(payload) {
    try {
      const formData = new FormData();
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === undefined) return;
        if (value === null) {
          formData.append(key, '');
          return;
        }
        formData.append(key, value);
      });

      const response = await api.post('/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data?.user) {
        setStoredCurrentUser(response.data.user);
      }

      return {
        success: true,
        user: response.data.user,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error actualizando perfil:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar perfil',
        errors: error.response?.data?.errors
      };
    }
  }
};

// Servicios de bookings
export const bookingService = {
  async getAll() {
    try {
      const response = await api.get('/bookings');
      return { success: true, bookings: response.data };
    } catch (error) {
      console.error('Error obteniendo bookings:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al obtener bookings' 
      };
    }
  },

  async update(bookingId, bookingData) {
    try {
      const response = await api.put(`/bookings/${bookingId}`, bookingData);
      return { success: true, booking: response.data.booking };
    } catch (error) {
      console.error('Error actualizando booking:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al actualizar booking',
        errors: error.response?.data?.errors
      };
    }
  },

  async create(bookingData) {
    try {
      const response = await api.post('/bookings', bookingData);
      return { success: true, booking: response.data.booking };
    } catch (error) {
      console.error('Error creando booking:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al crear booking',
        errors: error.response?.data?.errors
      };
    }
  },

  async delete(bookingId) {
    try {
      const response = await api.delete(`/bookings/${bookingId}`);
      return { success: true, message: response.data.message };
    } catch (error) {
      console.error('Error eliminando booking:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al eliminar agendamiento',
        error: error.response?.data?.error
      };
    }
  }
};

export const boldPaymentService = {
  async createLink(payload) {
    try {
      const response = await api.post('/payments/bold/link', payload);
      return {
        success: true,
        url: response.data?.url,
        paymentLink: response.data?.payment_link,
        amount: response.data?.amount,
        currency: response.data?.currency,
        description: response.data?.description,
      };
    } catch (error) {
      console.error('Error generando link de Bold:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al generar el link de pago con Bold',
        errors: error.response?.data?.errors,
      };
    }
  }
};

// Servicios del catalogo
export const serviceService = {
  async getAll() {
    try {
      const response = await api.get('/services');
      return { success: true, services: response.data };
    } catch (error) {
      console.error('Error obteniendo servicios:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener servicios'
      };
    }
  },

  async create(serviceData) {
    try {
      const response = await api.post('/services', serviceData);
      return { success: true, service: response.data.service };
    } catch (error) {
      console.error('Error creando servicio:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear servicio',
        errors: error.response?.data?.errors
      };
    }
  },

  async update(serviceId, serviceData) {
    try {
      const response = await api.put(`/services/${serviceId}`, serviceData);
      return { success: true, service: response.data.service };
    } catch (error) {
      console.error('Error actualizando servicio:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar servicio',
        errors: error.response?.data?.errors
      };
    }
  },

  async delete(serviceId) {
    try {
      const response = await api.delete(`/services/${serviceId}`);
      return { success: true, message: response.data.message };
    } catch (error) {
      console.error('Error eliminando servicio:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar servicio'
      };
    }
  }
};

// Servicios de referidos
export const referralService = {
  async getMyCommissions() {
    try {
      const response = await api.get('/my-referral-commissions');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error obteniendo comisiones:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener comisiones'
      };
    }
  },

  async getMyReferrals() {
    try {
      const response = await api.get('/my-referrals');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error obteniendo referidos:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener referidos'
      };
    }
  },

  async validateReferralCode(code) {
    try {
      const response = await api.post('/validate-referral-code', { code });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error validando código:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al validar código'
      };
    }
  },

  // Alias for easier usage
  async validateCode(code) {
    return this.validateReferralCode(code);
  },

  // Admin endpoints
  async getPaymentHistory() {
    try {
      const response = await api.get('/referral-payment-history');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error obteniendo historial:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener historial'
      };
    }
  },

  async markAsPaid(commissionId) {
    try {
      const response = await api.put(`/referral-commissions/${commissionId}/mark-paid`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error marcando como pagado:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al marcar como pagado'
      };
    }
  },

  async markAllAsPaid(referrerId) {
    try {
      const response = await api.put(`/referral-commissions/mark-all-paid/${referrerId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error marcando todos como pagados:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al marcar todos como pagados'
      };
    }
  },

  async getAllCommissions() {
    try {
      const response = await api.get('/referral-commissions');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error obteniendo comisiones admin:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener comisiones'
      };
    }
  }
};

export const sellerReferralService = {
  async resolveLink(token) {
    try {
      const response = await api.get(`/seller-referrals/link/${encodeURIComponent(token)}`);
      return { success: true, referral: response.data.referral };
    } catch (error) {
      console.error('Error resolviendo link de peluqueria:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al validar el link del establecimiento'
      };
    }
  },

  async getAll() {
    try {
      const response = await api.get('/seller-referrals');
      return { success: true, referrals: response.data.referrals || [] };
    } catch (error) {
      console.error('Error obteniendo referidos del vendedor:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener referidos del vendedor'
      };
    }
  },

  async getStatistics() {
    try {
      const response = await api.get('/seller-referrals/statistics');
      return { success: true, statistics: response.data.statistics || {} };
    } catch (error) {
      console.error('Error obteniendo estadísticas del vendedor:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener estadísticas del vendedor'
      };
    }
  },

  async getEarnings() {
    try {
      const response = await api.get('/seller-referrals/earnings');
      return {
        success: true,
        earnings: response.data.earnings || null,
        sellers: response.data.sellers || [],
        summary: response.data.summary || {},
      };
    } catch (error) {
      console.error('Error obteniendo ganancias del vendedor:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener ganancias del vendedor'
      };
    }
  },

  async getPartnerDashboard() {
    try {
      const response = await api.get('/seller-referrals/partner-dashboard');
      return {
        success: true,
        referral: response.data.referral || null,
        statistics: response.data.statistics || {},
        earnings: response.data.earnings || null,
        recentBookings: response.data.recent_bookings || [],
        monthlyHistory: response.data.monthly_history || [],
      };
    } catch (error) {
      console.error('Error obteniendo panel del establecimiento:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener el panel del establecimiento'
      };
    }
  },

  async create(payload) {
    try {
      const formData = new FormData();
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        formData.append(key, value);
      });

      const response = await api.post('/seller-referrals', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return {
        success: true,
        referral: response.data.referral,
        message: response.data.message,
        credentials: response.data.credentials || null,
      };
    } catch (error) {
      console.error('Error creando establecimiento:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al registrar establecimiento',
        errors: error.response?.data?.errors
      };
    }
  },

  async update(referralId, payload) {
    try {
      const formData = new FormData();
      formData.append('_method', 'PUT');
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === undefined) return;
        if (value === null) {
          formData.append(key, '');
          return;
        }
        formData.append(key, value);
      });

      const response = await api.post(`/seller-referrals/${referralId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return {
        success: true,
        referral: response.data.referral,
        message: response.data.message,
      };
    } catch (error) {
      console.error('Error actualizando establecimiento:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar establecimiento',
        errors: error.response?.data?.errors
      };
    }
  },

  async review(referralId, payload) {
    try {
      const response = await api.put(`/seller-referrals/${referralId}/review`, payload);
      return { success: true, referral: response.data.referral, message: response.data.message };
    } catch (error) {
      console.error('Error revisando referido de vendedor:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al revisar referido',
        errors: error.response?.data?.errors
      };
    }
  }
};

// Configuración de aplicación
const SELLER_VISITS_SUPPORT_KEY = `seller-visits-support:${API_URL}`;

const getSellerVisitsSupport = () => {
  try {
    const value = localStorage.getItem(SELLER_VISITS_SUPPORT_KEY);
    if (value === 'unsupported') return false;
    if (value === 'supported') return true;
  } catch (error) {
    // ignore storage errors
  }
  return true;
};

const setSellerVisitsSupport = (supported) => {
  try {
    localStorage.setItem(SELLER_VISITS_SUPPORT_KEY, supported ? 'supported' : 'unsupported');
  } catch (error) {
    // ignore storage errors
  }
};

export const sellerVisitService = {
  isSupported() {
    return getSellerVisitsSupport();
  },

  async getAll(options = {}) {
    const forceRefresh = options?.force === true;

    if (!forceRefresh && !getSellerVisitsSupport()) {
      return {
        success: true,
        visits: [],
        supported: false,
        message: 'El backend actual no tiene habilitado el historial de visitas comerciales.'
      };
    }

    try {
      const response = await api.get('/seller-visits');
      setSellerVisitsSupport(true);
      return { success: true, visits: response.data.visits || [], supported: true };
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || '';
      const missingRoute = status === 404 && typeof message === 'string' && message.toLowerCase().includes('seller-visits');
      if (missingRoute) {
        setSellerVisitsSupport(false);
        return {
          success: true,
          visits: [],
          supported: false,
          message: 'El backend actual no tiene habilitado el historial de visitas comerciales.'
        };
      }

      console.error('Error obteniendo visitas comerciales:', error.response?.data);
      return {
        success: false,
        supported: true,
        message: error.response?.data?.message || 'Error al obtener visitas comerciales'
      };
    }
  },

  async create(payload) {
    if (!getSellerVisitsSupport()) {
      return {
        success: false,
        supported: false,
        message: 'Este backend todavia no soporta el registro de visitas comerciales.'
      };
    }

    try {
      const formData = new FormData();
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        formData.append(key, value);
      });

      const response = await api.post('/seller-visits', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSellerVisitsSupport(true);
      return {
        success: true,
        visit: response.data.visit,
        message: response.data.message,
        supported: true,
      };
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || '';
      const missingRoute = status === 404 && typeof message === 'string' && message.toLowerCase().includes('seller-visits');
      if (missingRoute) {
        setSellerVisitsSupport(false);
        return {
          success: false,
          supported: false,
          message: 'Este backend todavía no soporta el registro de visitas comerciales.'
        };
      }

      console.error('Error creando visita comercial:', error.response?.data);
      return {
        success: false,
        supported: true,
        message: error.response?.data?.message || 'Error al registrar visita comercial',
        errors: error.response?.data?.errors
      };
    }
  }
};

export const geolocationService = {
  async getAll() {
    try {
      const response = await api.get('/geolocations');
      return {
        success: response.data?.success !== false,
        supported: response.data?.supported !== false,
        locations: response.data.locations || [],
        serverTime: response.data.server_time || null,
        message: response.data?.message || '',
      };
    } catch (error) {
      console.error('Error obteniendo geolocalizaciones:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener geolocalizaciones',
      };
    }
  },

  async update(payload) {
    try {
      const response = await api.put('/geolocation', payload);
      return {
        success: response.data?.success !== false,
        supported: response.data?.supported !== false,
        location: response.data.location || null,
        message: response.data?.message || '',
      };
    } catch (error) {
      console.error('Error actualizando geolocalizacion:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar geolocalizacion',
      };
    }
  },
};

export const messagingService = {
  async getAll() {
    try {
      const response = await api.get('/messages');
      return {
        success: true,
        messages: response.data.messages || [],
      };
    } catch (error) {
      console.error('Error obteniendo mensajes:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener mensajes'
      };
    }
  },

  async create(payload) {
    try {
      const formData = new FormData();
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        formData.append(key, value);
      });

      const response = await api.post('/messages', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return {
        success: true,
        message: response.data.message,
        adminMessage: response.data.admin_message || null,
      };
    } catch (error) {
      console.error('Error enviando mensaje a administración:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al enviar el mensaje',
        errors: error.response?.data?.errors
      };
    }
  },

  async reply(messageId, payload) {
    try {
      const response = await api.put(`/messages/${messageId}/reply`, payload);
      return {
        success: true,
        message: response.data.message,
        adminMessage: response.data.admin_message || null,
      };
    } catch (error) {
      console.error('Error respondiendo mensaje:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al responder el mensaje',
        errors: error.response?.data?.errors
      };
    }
  }
};

export const settingsService = {
  async getBookingSettings() {
    const defaultSettings = {
      requireAdvance12h: true,
      whatsappConfirmationTemplate: DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE,
      sellerReferralValue: 5000,
      partnerCommissionTiers: [
        { from: 1, to: 20, value: 5000 },
        { from: 21, to: 40, value: 7000 },
        { from: 41, to: null, value: 100000 },
      ],
      termsAndConditions: DEFAULT_TERMS_AND_CONDITIONS
    };
    try {
      const response = await api.get('/booking-settings');
      const responseSettings = response.data?.settings || {};
      return {
        success: true,
        settings: {
          ...defaultSettings,
          ...responseSettings,
          termsAndConditions: {
            ...DEFAULT_TERMS_AND_CONDITIONS,
            ...(responseSettings.termsAndConditions || {})
          }
        }
      };
    } catch (error) {
      console.error('Error obteniendo configuración de agendamiento:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener configuración',
        settings: defaultSettings
      };
    }
  },

  async updateBookingSettings(payload) {
    const defaultSettings = {
      requireAdvance12h: true,
      whatsappConfirmationTemplate: DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE,
      sellerReferralValue: 5000,
      partnerCommissionTiers: [
        { from: 1, to: 20, value: 5000 },
        { from: 21, to: 40, value: 7000 },
        { from: 41, to: null, value: 100000 },
      ],
      termsAndConditions: DEFAULT_TERMS_AND_CONDITIONS
    };
    try {
      const response = await api.put('/booking-settings', payload);
      const responseSettings = response.data?.settings || {};
      return {
        success: true,
        settings: {
          ...defaultSettings,
          ...payload,
          ...responseSettings,
          termsAndConditions: {
            ...DEFAULT_TERMS_AND_CONDITIONS,
            ...(payload.termsAndConditions || {}),
            ...(responseSettings.termsAndConditions || {})
          }
        }
      };
    } catch (error) {
      console.error('Error actualizando configuración de agendamiento:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar configuración'
      };
    }
  }
};

export default api;
