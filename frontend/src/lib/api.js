import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

// Crear instancia de axios con configuración
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

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
    if (error.response?.status === 401) {
      // Token inválido o expirado
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
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
      
      const { token, user } = response.data;
      
      // Guardar token y usuario en localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('current_user', JSON.stringify(user));
      
      return { success: true, user, token };
    } catch (error) {
      console.error('Login error:', error.response?.data);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error al iniciar sesión' 
      };
    }
  },

  async logout() {
    try {
      await api.post('/logout');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      return { success: true };
    } catch (error) {
      // Limpiar localStorage de todas formas
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
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
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken() {
    return localStorage.getItem('auth_token');
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
  }
};

export default api;
