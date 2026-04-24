import React, { useState, useEffect, useCallback, lazy, Suspense, startTransition } from 'react';
import { motion } from 'framer-motion';
import { User, Map, Loader, RefreshCw, Menu, Building2, FileText, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ScheduleManagement from '@/components/ScheduleManagement';
import PiojologistMap from '@/components/PiojologistMap';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import DashboardModule from '@/components/admin/DashboardModule';
import MessagingModule from '@/components/MessagingModule';
import { geocodeAddress } from '@/lib/geocoding';
import { bookingService, referralService, sellerReferralService, settingsService, userService } from '@/lib/api';
import {
  DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE,
  SMS_TEMPLATE_VARIABLES
} from '@/lib/bookingSmsTemplate';
import {
  DEFAULT_TERMS_AND_CONDITIONS,
  TERMS_ROLE_DESCRIPTIONS,
  TERMS_ROLE_LABELS
} from '@/lib/termsConditions';

const DEFAULT_PARTNER_COMMISSION_TIERS = [
  { from: 1, to: 20, value: 5000 },
  { from: 21, to: 40, value: 7000 },
  { from: 41, to: null, value: 100000 },
];

const normalizePartnerCommissionTiers = (tiers) => {
  if (!Array.isArray(tiers) || tiers.length === 0) return DEFAULT_PARTNER_COMMISSION_TIERS;

  const normalized = tiers
    .map((tier, index) => ({
      id: tier?.id || `tier-${index + 1}`,
      from: Number(tier?.from || 1),
      to: tier?.to === null || typeof tier?.to === 'undefined' || tier?.to === '' ? null : Number(tier.to),
      value: Number(tier?.value || 0),
    }))
    .filter((tier) => Number.isFinite(tier.from) && tier.from >= 1 && Number.isFinite(tier.value) && tier.value >= 0)
    .sort((a, b) => a.from - b.from);

  return normalized.length > 0 ? normalized : DEFAULT_PARTNER_COMMISSION_TIERS;
};

const buildReferralBookingLink = (referralCode) => (
  referralCode ? `${window.location.origin}/agenda?ref=${encodeURIComponent(referralCode)}` : ''
);

const INITIAL_USER_FORM_DATA = {
  name: '',
  email: '',
  password: '',
  role: 'piojologa',
  specialty: '',
  available: true,
  is_active: true,
  address: '',
  commission_rate: 50,
  referral_value: 15000,
  referral_code_used: '',
  referral_code: '',
  business_name: '',
  owner_name: '',
  whatsapp: '',
  nit: '',
  city: '',
  notes: '',
  chamber_of_commerce: null,
  rut: null,
  logo: null,
  citizenship_card: null,
};

const buildEstablishmentFormData = (referral = null, user = null) => ({
  ...INITIAL_USER_FORM_DATA,
  role: 'referido',
  available: false,
  is_active: referral?.referred_user?.is_active ?? user?.is_active ?? true,
  business_name: referral?.business_name || user?.name || '',
  name: referral?.business_name || user?.name || '',
  owner_name: referral?.owner_name || '',
  whatsapp: referral?.whatsapp || referral?.phone || '',
  email: referral?.referred_user?.email || referral?.email || user?.email || '',
  password: '',
  nit: referral?.nit || '',
  city: referral?.city || '',
  address: referral?.address || user?.address || '',
  lat: referral?.lat ?? user?.lat ?? null,
  lng: referral?.lng ?? user?.lng ?? null,
  notes: referral?.notes || '',
  chamber_of_commerce: null,
  rut: null,
  logo: null,
  citizenship_card: null,
});

// Lazy load módulos pesados para mejor rendimiento
const UsersModule = lazy(() => import('@/components/admin/UsersModule'));
const ProductsModule = lazy(() => import('@/components/admin/ProductsModule'));
const ServicesModule = lazy(() => import('@/components/admin/ServicesModule'));
const EarningsModule = lazy(() => import('@/components/admin/EarningsModule'));
const RequestsModule = lazy(() => import('@/components/admin/RequestsModule'));
const SellerReferralsModule = lazy(() => import('@/components/admin/SellerReferralsModule'));
const SellerVisitsModule = lazy(() => import('@/components/admin/SellerVisitsModule'));
const GeolocationModule = lazy(() => import('@/components/admin/GeolocationModule'));
const ProductDetailDialog = lazy(() => import('@/components/admin/dialogs/ProductDetailDialog'));

// Lazy load diálogos para mejor rendimiento
const ServiceCatalogDialog = lazy(() => import('@/components/admin/dialogs/ServiceCatalogDialog'));
const DeleteConfirmDialog = lazy(() => import('@/components/admin/dialogs/DeleteConfirmDialog'));
const UserDetailDialog = lazy(() => import('@/components/admin/dialogs/UserDetailDialog'));
const EarningsDialog = lazy(() => import('@/components/admin/dialogs/EarningsDialog'));

const AdminView = ({ currentUser, users, handleCreateUser, handleUpdateUser, handleToggleUserActive, appointments, baseAppointments = [], bookings = [], updateAppointments, updateBookings, reloadUsers, reloadBookings, onDeleteBooking, piojologists, products, updateProducts, services = [], onCreateService, onUpdateService, onDeleteService, serviceCatalog, formatCurrency, syncICalEvents, productRequests, onApproveRequest, onRejectRequest, onNotify }) => {
  const { toast } = useToast();
  
  // User Management State
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isGeocodifying, setIsGeocodifying] = useState(false);
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [referralCodeValidation, setReferralCodeValidation] = useState({ isValidating: false, isValid: null, message: '' });
  const [userFormData, setUserFormData] = useState(INITIAL_USER_FORM_DATA);

  // Service Creation State
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);

  // Delete Confirmation Modals
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'service' or 'product'

  // Earnings Modal State
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [earningsHistory, setEarningsHistory] = useState([]);
  const [referralCommissionsList, setReferralCommissionsList] = useState([]);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  
  // Detalles de Servicios por Piojóloga Modal
  const [openPayDialog, setOpenPayDialog] = useState(null); // ID de la piojóloga para pagar servicios
  const [openHistoryDialog, setOpenHistoryDialog] = useState(null); // ID de la piojóloga para ver historial
  const [bookingRequireAdvance12h, setBookingRequireAdvance12h] = useState(true);
  const [bookingSettingsLoading, setBookingSettingsLoading] = useState(false);
  const [whatsappTemplateDraft, setWhatsappTemplateDraft] = useState(DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE);
  const [smsSettingsSaving, setSmsSettingsSaving] = useState(false);
  const [sellerReferralValueDraft, setSellerReferralValueDraft] = useState(5000);
  const [sellerReferralSettingsSaving, setSellerReferralSettingsSaving] = useState(false);
  const [partnerCommissionTiersDraft, setPartnerCommissionTiersDraft] = useState(DEFAULT_PARTNER_COMMISSION_TIERS);
  const [partnerCommissionSettingsSaving, setPartnerCommissionSettingsSaving] = useState(false);
  const [termsSettingsDraft, setTermsSettingsDraft] = useState(DEFAULT_TERMS_AND_CONDITIONS);
  const [termsSettingsSaving, setTermsSettingsSaving] = useState(false);


  // Persist active tab across refresh
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('adminTab') || 'dashboard');
  const [settingsTab, setSettingsTab] = useState(() => localStorage.getItem('adminSettingsTab') || 'agenda');
  const [termsRoleTab, setTermsRoleTab] = useState(() => localStorage.getItem('adminTermsSettingsTab') || 'piojologa');
  const [dashboardFocus, setDashboardFocus] = useState(null);
  const handleTabChange = (value) => {
    startTransition(() => {
      setActiveTab(value);
      localStorage.setItem('adminTab', value);
    });
  };
  const handleSettingsTabChange = (value) => {
    setSettingsTab(value);
    localStorage.setItem('adminSettingsTab', value);
  };
  const handleTermsRoleTabChange = (value) => {
    setTermsRoleTab(value);
    localStorage.setItem('adminTermsSettingsTab', value);
  };
  const handleOpenUserStats = useCallback((user) => {
    const tabMap = {
      referido: 'establecimientos',
      vendedor: 'vendedores',
      piojologa: 'piojologas',
    };
    const targetTab = tabMap[user?.role];
    if (!targetTab) return;

    const search = String(user?.business_name || user?.name || user?.email || '').trim();
    const request = {
      tab: targetTab,
      search,
      requestId: `${user?.id || 'user'}-${Date.now()}`,
    };

    startTransition(() => {
      setDashboardFocus(request);
      setActiveTab('dashboard');
      localStorage.setItem('adminTab', 'dashboard');
    });
  }, []);

  const loadReferralPaymentHistory = useCallback(async (showErrorToast = false) => {
    setLoadingEarnings(true);
    try {
      const [historyResult, commissionsResult] = await Promise.all([
        referralService.getPaymentHistory(),
        referralService.getAllCommissions()
      ]);

      if (historyResult.success) {
        setEarningsHistory(historyResult.data.piojologists || []);
      }
      if (commissionsResult.success) {
        setReferralCommissionsList(commissionsResult.data.commissions || []);
      }

      if (historyResult.success && commissionsResult.success) {
        return true;
      }

      if (showErrorToast) {
        toast({
          title: "❌ Error",
          description: "No se pudo cargar el historial de comisiones",
          variant: "destructive"
        });
      }
      return false;
    } catch (error) {
      console.error('Error cargando historial:', error);
      if (showErrorToast) {
        toast({
          title: "❌ Error",
          description: "No se pudo cargar el historial de comisiones",
          variant: "destructive"
        });
      }
      return false;
    } finally {
      setLoadingEarnings(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'earnings') {
      loadReferralPaymentHistory(false);
    }
  }, [activeTab, loadReferralPaymentHistory]);

  useEffect(() => {
    let isMounted = true;
    const loadBookingSettings = async () => {
      setBookingSettingsLoading(true);
      const result = await settingsService.getBookingSettings();
      if (isMounted && result.success) {
        setBookingRequireAdvance12h(!!result.settings?.requireAdvance12h);
        const template = result.settings?.whatsappConfirmationTemplate || DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE;
        setSellerReferralValueDraft(Number(result.settings?.sellerReferralValue ?? 5000));
        setPartnerCommissionTiersDraft(normalizePartnerCommissionTiers(result.settings?.partnerCommissionTiers));
        setWhatsappTemplateDraft(template);
        setTermsSettingsDraft({
          ...DEFAULT_TERMS_AND_CONDITIONS,
          ...(result.settings?.termsAndConditions || {})
        });
        try {
          localStorage.setItem('booking_whatsapp_template', template);
        } catch (e) {
          // ignore storage sync errors
        }
      }
      if (isMounted) setBookingSettingsLoading(false);
    };
    loadBookingSettings();
    return () => { isMounted = false; };
  }, []);

  const handleToggleBookingAdvance12h = async (checked) => {
    const previous = bookingRequireAdvance12h;
    setBookingRequireAdvance12h(checked);
    try {
      localStorage.setItem('booking_require_12h', checked ? '1' : '0');
      window.dispatchEvent(new CustomEvent('booking-settings-updated', {
        detail: {
          requireAdvance12h: checked,
          whatsappConfirmationTemplate: whatsappTemplateDraft,
          termsAndConditions: termsSettingsDraft
        }
      }));
    } catch (e) {
      // ignore storage sync errors
    }
    const result = await settingsService.updateBookingSettings({ requireAdvance12h: checked });
    if (!result.success) {
      setBookingRequireAdvance12h(previous);
      try {
        localStorage.setItem('booking_require_12h', previous ? '1' : '0');
        window.dispatchEvent(new CustomEvent('booking-settings-updated', {
          detail: {
            requireAdvance12h: previous,
            whatsappConfirmationTemplate: whatsappTemplateDraft,
            termsAndConditions: termsSettingsDraft
          }
        }));
      } catch (e) {
        // ignore storage sync errors
      }
      toast({
        title: "❌ Error",
        description: result.message || "No se pudo actualizar la regla de anticipación",
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "✅ Configuración actualizada",
      description: checked
        ? "Se exige anticipación mínima de 12 horas."
        : "Se permite agendar sin anticipación mínima de 12 horas."
    });
  };

  const handleSaveSmsSettings = async () => {
    const nextTemplate = (whatsappTemplateDraft || '').trim();
    if (!nextTemplate) {
      toast({
        title: "❌ Plantilla vacía",
        description: "Debes escribir un mensaje para guardar la configuración.",
        variant: "destructive"
      });
      return;
    }

    setSmsSettingsSaving(true);
    const result = await settingsService.updateBookingSettings({
      whatsappConfirmationTemplate: nextTemplate
    });
    setSmsSettingsSaving(false);

    if (!result.success) {
      toast({
        title: "❌ Error",
        description: result.message || "No se pudo actualizar la plantilla de WhatsApp",
        variant: "destructive"
      });
      return;
    }

    const savedTemplate = result.settings?.whatsappConfirmationTemplate || nextTemplate;
    setWhatsappTemplateDraft(savedTemplate);

    try {
      localStorage.setItem('booking_whatsapp_template', savedTemplate);
      window.dispatchEvent(new CustomEvent('booking-settings-updated', {
        detail: {
          requireAdvance12h: bookingRequireAdvance12h,
          whatsappConfirmationTemplate: savedTemplate,
          termsAndConditions: termsSettingsDraft
        }
      }));
    } catch (e) {
      // ignore storage sync errors
    }

    toast({
      title: "✅ Configuración actualizada",
      description: "La plantilla SMS/WhatsApp fue guardada correctamente."
    });
  };

  const handleResetSmsTemplate = () => {
    setWhatsappTemplateDraft(DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE);
  };

  const handleTermsDraftChange = (role, value) => {
    setTermsSettingsDraft((current) => ({
      ...current,
      [role]: value,
    }));
  };

  const handleSaveTermsSettings = async () => {
    const normalizedTerms = Object.entries(termsSettingsDraft).reduce((acc, [role, value]) => {
      acc[role] = String(value || '').trim();
      return acc;
    }, {});

    const hasEmptyTerms = Object.values(normalizedTerms).some((value) => !value);
    if (hasEmptyTerms) {
      toast({
        title: "❌ Términos incompletos",
        description: "Debes escribir el contenido de términos y condiciones para los tres roles.",
        variant: "destructive"
      });
      return;
    }

    setTermsSettingsSaving(true);
    const result = await settingsService.updateBookingSettings({
      termsAndConditions: normalizedTerms
    });
    setTermsSettingsSaving(false);

    if (!result.success) {
      toast({
        title: "❌ Error",
        description: result.message || "No se pudieron actualizar los términos y condiciones",
        variant: "destructive"
      });
      return;
    }

    const savedTerms = {
      ...DEFAULT_TERMS_AND_CONDITIONS,
      ...(result.settings?.termsAndConditions || normalizedTerms)
    };
    setTermsSettingsDraft(savedTerms);

    window.dispatchEvent(new CustomEvent('booking-settings-updated', {
      detail: {
        requireAdvance12h: bookingRequireAdvance12h,
        whatsappConfirmationTemplate: whatsappTemplateDraft,
        termsAndConditions: savedTerms
      }
    }));

    toast({
      title: "✅ Configuración actualizada",
      description: "Los términos y condiciones por rol quedaron guardados."
    });
  };

  const handleSaveSellerReferralSettings = async () => {
    const nextValue = Number(sellerReferralValueDraft);
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      toast({
        title: "❌ Valor inválido",
        description: "Debes ingresar un valor global válido para vendedores.",
        variant: "destructive"
      });
      return;
    }

    setSellerReferralSettingsSaving(true);
    const result = await settingsService.updateBookingSettings({
      sellerReferralValue: nextValue
    });
    setSellerReferralSettingsSaving(false);

    if (!result.success) {
      toast({
        title: "❌ Error",
        description: result.message || "No se pudo actualizar la comisión global de vendedores",
        variant: "destructive"
      });
      return;
    }

    const savedValue = Number(result.settings?.sellerReferralValue ?? nextValue);
    setSellerReferralValueDraft(savedValue);
    toast({
      title: "✅ Configuración actualizada",
      description: `La comisión global por cabeza para vendedores quedó en ${toMoney(savedValue)}.`
    });
  };

  const handlePartnerTierChange = (index, field, value) => {
    setPartnerCommissionTiersDraft((current) => current.map((tier, tierIndex) => {
      if (tierIndex !== index) return tier;
      return {
        ...tier,
        [field]: value,
      };
    }));
  };

  const handleSavePartnerCommissionSettings = async () => {
    const normalizedTiers = normalizePartnerCommissionTiers(partnerCommissionTiersDraft).map((tier) => ({
      from: Number(tier.from || 1),
      to: tier.to === null || tier.to === '' ? null : Number(tier.to),
      value: Number(tier.value || 0),
    }));

    const hasInvalidTier = normalizedTiers.some((tier) => (
      !Number.isFinite(tier.from)
      || tier.from < 1
      || (tier.to !== null && (!Number.isFinite(tier.to) || tier.to < tier.from))
      || !Number.isFinite(tier.value)
      || tier.value < 0
    ));

    if (hasInvalidTier) {
      toast({
        title: "❌ Tramos inválidos",
        description: "Revisa los valores de los tramos antes de guardar la comisión de establecimientos.",
        variant: "destructive"
      });
      return;
    }

    setPartnerCommissionSettingsSaving(true);
    const result = await settingsService.updateBookingSettings({
      partnerCommissionTiers: normalizedTiers
    });
    setPartnerCommissionSettingsSaving(false);

    if (!result.success) {
      toast({
        title: "❌ Error",
        description: result.message || "No se pudo actualizar la comisión de establecimientos",
        variant: "destructive"
      });
      return;
    }

    const savedTiers = normalizePartnerCommissionTiers(result.settings?.partnerCommissionTiers);
    setPartnerCommissionTiersDraft(savedTiers);
    toast({
      title: "✅ Configuración actualizada",
      description: "Los tramos mensuales de comisión para establecimientos quedaron guardados."
    });
  };

  // Mobile nav toggle for tabs
  const [isNavOpen, setIsNavOpen] = useState(false);
  useEffect(() => {
    // Close mobile nav when tab changes
    setIsNavOpen(false);
  }, [activeTab]);

  // Resolver nombres de piojólogas faltantes en bookings/appointments combinados
  const normalizeRejectionHistory = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return value.split(',').map(v => v.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const displayAppointments = appointments.map(apt => {
    const rejectionHistory = normalizeRejectionHistory(apt.rejectionHistory || apt.rejection_history || apt.rejections);
    const base = {
      ...apt,
      rejectionHistory
    };

    if (base.piojologistName || !base.piojologistId) return base;
    const match = piojologists.find(p => Number(p.id) === Number(base.piojologistId));
    return match ? { ...base, piojologistName: match.name } : base;
  });

  const getServicePrice = (apt = {}) => {
    // Priorizar siempre el valor confirmado/guardado en la reserva
    const raw = apt.price_confirmed ?? apt.price ?? apt.estimatedPrice;
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) return num;

    // Fallback: calcular por servicios por persona si no hay precio confirmado
    if (apt.services_per_person && Array.isArray(apt.services_per_person)) {
      return apt.services_per_person.reduce((sum, serviceType) => {
        return sum + (serviceCatalog[serviceType] || 0);
      }, 0);
    }

    return Number(serviceCatalog[apt.serviceType] || 0);
  };

  const toMoney = (amount = 0) => {
    if (typeof formatCurrency === 'function') return formatCurrency(amount);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
  };

  const resolveRequestTotals = (request = {}) => {
    const baseKitPrice = Number(request.kitPrice ?? 300000);
    const itemsTotal = (request.items || []).reduce((sum, item) => sum + (Number(item.price ?? 0) * Number(item.quantity ?? 1)), 0);
    const total = request.isKitCompleto ? baseKitPrice : Number(request.totalPrice ?? itemsTotal);
    const studioShare = request.isKitCompleto ? Number(request.studioContribution ?? (request.isFirstKitBenefit ? baseKitPrice / 2 : 0)) : 0;
    const piojologistShare = request.isKitCompleto ? Number(request.piojologistContribution ?? (total - studioShare)) : total;
    return { baseKitPrice, itemsTotal, total, studioShare, piojologistShare };
  };

  // Product Management State
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    price: '',
    stock: '',
    image: ''
  });

  // Service Management State
  const [editingService, setEditingService] = useState(null);
  const [serviceCatalogFormData, setServiceCatalogFormData] = useState({
    name: '',
    value: ''
  });

  const resetUserForm = () => {
    setUserFormData(INITIAL_USER_FORM_DATA);
    setEditingUser(null);
    setReferralCodeValidation({ isValid: true, message: '' });
  };

  const resetProductForm = () => {
    setProductFormData({
      name: '',
      price: '',
      stock: '',
      image: ''
    });
    setEditingProduct(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductFormData({...productFormData, image: reader.result});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setProductFormData({...productFormData, image: ''});
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    // Si ya es una URL completa o base64, devolverla tal como está
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }
    // Si es una ruta relativa, construir la URL completa
    return `/storage/products/${imagePath}`;
  };

  const formatPriceInput = (value) => {
    if (!value) return '';
    // Formatear con puntos de miles al estilo colombiano
    const numericValue = value.toString().replace(/[^\d]/g, '');
    if (!numericValue) return '';
    return parseInt(numericValue).toLocaleString('es-CO');
  };

  const handlePriceChange = (e) => {
    let value = e.target.value;
    // Remover todo excepto números
    value = value.replace(/[^\d]/g, '');
    
    setProductFormData({...productFormData, price: value});
  };

  const formatDate12H = (dateString) => {
    if (!dateString) return 'No especificado';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      
      return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Error en fecha';
    }
  };

  const handleOpenUserDialog = async (user = null) => {
    if (user) {
      if (user.role === 'referido') {
        const referralsResult = await sellerReferralService.getAll();
        if (!referralsResult.success) {
          toast({
            title: 'Error',
            description: referralsResult.message || 'No se pudo cargar la información del establecimiento',
            variant: 'destructive',
            className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
          });
          return;
        }

        const referral = (referralsResult.referrals || []).find((item) => (
          Number(item?.referred_user_id) === Number(user.id)
          || Number(item?.referred_user?.id) === Number(user.id)
          || (item?.referred_user?.email && item.referred_user.email === user.email)
          || (item?.email && item.email === user.email)
        ));

        if (!referral) {
          toast({
            title: 'Error',
            description: 'No se encontró el registro comercial asociado a este establecimiento.',
            variant: 'destructive',
            className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
          });
          return;
        }

        setEditingUser({ ...referral, role: 'referido' });
        setUserFormData(buildEstablishmentFormData(referral, user));
      } else {
        setEditingUser(user);
        setUserFormData({
          ...INITIAL_USER_FORM_DATA,
          ...user,
          referral_value: Number(user.referral_value ?? (user.role === 'vendedor' ? sellerReferralValueDraft : 15000))
        });
      }
    } else {
      resetUserForm();
    }
    setIsUserDialogOpen(true);
  };

  const handleOpenEstablishmentDialog = () => {
    setEditingUser(null);
    setUserFormData(buildEstablishmentFormData());
    setReferralCodeValidation({ isValid: true, message: '' });
    setIsUserDialogOpen(true);
  };

  const handleOpenUserDetail = (user) => {
    // Buscar el usuario más reciente del array users para asegurar datos actualizados
    const freshUser = users.find(u => u.id === user.id) || user;
    setDetailUser(freshUser);
    setIsUserDetailOpen(true);
  };

  const handleCopyReferralLink = async (referralCode) => {
    const referralLink = buildReferralBookingLink(referralCode);
    if (!referralLink) return;

    try {
      await navigator.clipboard.writeText(referralLink);
      toast({
        title: 'Link copiado',
        description: 'El link de referido quedó copiado.',
        className: 'bg-green-100 border-2 border-green-200 text-green-800 rounded-2xl font-bold'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el link de referido.',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
    }
  };

  const handleRegenerateReferralCode = async (userId) => {
    const result = await userService.regenerateReferralCode(userId);

    if (!result.success) {
      toast({
        title: '❌ Error',
        description: result.message || 'No se pudo regenerar el código',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    const refreshedUser = result.data?.user || null;
    const nextCode = result.data?.referral_code || refreshedUser?.referral_code || '';

    setUserFormData((prev) => ({
      ...prev,
      referral_code: nextCode,
    }));

    if (refreshedUser) {
      setEditingUser(refreshedUser);
      setDetailUser((prev) => (prev?.id === refreshedUser.id ? refreshedUser : prev));
    }

    if (typeof reloadUsers === 'function') {
      await reloadUsers();
    }

    toast({
      title: '🎯 Código regenerado',
      description: `Nuevo código: ${nextCode}`,
      className: 'bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200'
    });
  };

  const handleOpenEarningsModal = async () => {
    setShowEarningsModal(true);
    await loadReferralPaymentHistory(true);
  };

  const handlePayAll = async (piojologist) => {
    try {
      const result = await referralService.markAllAsPaid(piojologist.id);
      if (result.success) {
        toast({
          title: "✅ Pagos realizados",
          description: `Se han marcado todas las comisiones de ${piojologist.name} como pagadas`,
          className: "bg-green-100 border-2 border-green-200 text-green-800 rounded-2xl font-bold"
        });
        // Recargar historial
        await loadReferralPaymentHistory(true);
      } else {
        toast({
          title: "❌ Error",
          description: result.message || "No se pudieron marcar los pagos",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error pagando comisiones:', error);
      toast({
        title: "❌ Error",
        description: "Ocurrió un error al procesar los pagos",
        variant: "destructive"
      });
    }
  };

  const handlePayOneReferral = async (commission, piojologistName = 'la piojóloga') => {
    try {
      const result = await referralService.markAsPaid(commission.id);
      if (result.success) {
        toast({
          title: "✅ Comisión pagada",
          description: `Se marcó la comisión #${commission.id} como pagada para ${piojologistName}`,
          className: "bg-green-100 border-2 border-green-200 text-green-800 rounded-2xl font-bold"
        });
        await loadReferralPaymentHistory(true);
      } else {
        toast({
          title: "❌ Error",
          description: result.message || "No se pudo marcar la comisión como pagada",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error pagando comisión individual:', error);
      toast({
        title: "❌ Error",
        description: "Ocurrió un error al procesar el pago individual",
        variant: "destructive"
      });
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setIsGeocodifying(true);

    try {
      const buildValidationMessage = (result, fallback) => {
        const errorMap = result?.errors;
        if (errorMap && typeof errorMap === 'object') {
          const lines = Object.values(errorMap)
            .flat()
            .filter(Boolean)
            .map((value) => String(value).trim())
            .filter(Boolean);

          if (lines.length > 0) {
            return lines.join(' | ');
          }
        }

        return result?.message || fallback;
      };

      let userToSave = { ...userFormData };

      if (userToSave.role === 'referido') {
        userToSave = {
          ...userToSave,
          business_name: userToSave.business_name?.trim() || userToSave.name?.trim() || '',
        };
      }

      if (userToSave.role === 'piojologa') {
        const referralValue = Number(userToSave.referral_value);
        userToSave.referral_value = Number.isFinite(referralValue) && referralValue >= 0 ? referralValue : 15000;
      } else if (userToSave.role === 'vendedor') {
        const referralValue = Number(userToSave.referral_value);
        userToSave.referral_value = Number.isFinite(referralValue) && referralValue >= 0 ? referralValue : Number(sellerReferralValueDraft || 5000);
      } else {
        delete userToSave.referral_value;
      }

      // Validar código de referido si se está usando uno
      if (!editingUser && userToSave.referral_code_used && userToSave.role === 'piojologa') {
        if (!referralCodeValidation.isValid) {
          toast({
            title: "❌ Código de referido inválido",
            description: "Por favor verifica el código de referido.",
            variant: "destructive",
            className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
          });
          setIsGeocodifying(false);
          return;
        }
      }

      // Si tiene dirección pero no coordenadas (edición sin autocomplete), geocodificar.
      if (['piojologa', 'referido'].includes(userToSave.role) && userToSave.address && !userToSave.lat) {
        const coordinates = await geocodeAddress(userToSave.address);
        if (coordinates) {
          userToSave = {
            ...userToSave,
            lat: coordinates.lat,
            lng: coordinates.lng
          };
          toast({
            title: "📍 Ubicación encontrada",
            description: `Coordenadas: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`,
            className: "bg-cyan-100 text-cyan-800 rounded-2xl border-2 border-cyan-200"
          });
        } else {
          toast({
            title: "⚠️ Ubicación no encontrada",
            description: "Se guardará la dirección sin coordenadas. Verifica la dirección.",
            variant: "destructive",
            className: "rounded-3xl border-4 border-yellow-200 bg-yellow-50 text-yellow-600 font-bold"
          });
        }
      }

      let result;
      if (editingUser) {
        if (userToSave.role === 'referido') {
          const establishmentPayload = {
            business_name: userToSave.business_name,
            owner_name: userToSave.owner_name?.trim() || '',
            whatsapp: userToSave.whatsapp?.trim() || '',
            email: userToSave.email?.trim() || '',
            password: userToSave.password || '',
            city: userToSave.city?.trim() || '',
            address: userToSave.address?.trim() || '',
            lat: userToSave.lat ?? null,
            lng: userToSave.lng ?? null,
            nit: userToSave.nit?.trim() || '',
            notes: userToSave.notes?.trim() || '',
            chamber_of_commerce: userToSave.chamber_of_commerce || null,
            rut: userToSave.rut || null,
            logo: userToSave.logo || null,
            citizenship_card: userToSave.citizenship_card || null,
          };

          result = await sellerReferralService.update(editingUser.id, establishmentPayload);
          if (result.success) {
            toast({
              title: "Establecimiento actualizado",
              description: result.message || "Los cambios del establecimiento quedaron guardados.",
              className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200"
            });
            setIsUserDialogOpen(false);
            resetUserForm();
            await reloadUsers?.();
          } else {
            toast({
              title: "Error al actualizar",
              description: buildValidationMessage(result, "No se pudo actualizar el establecimiento"),
              variant: "destructive",
              className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
            });
          }
          return;
        }

        result = await handleUpdateUser({ ...userToSave, id: editingUser.id });
        if (result.success) {
          // Si el usuario editado es el que está en detailUser, actualizarlo con los datos frescos
          if (detailUser && detailUser.id === editingUser.id) {
            setDetailUser(result.user);
          }
          toast({ title: "¡Usuario Actualizado! 🎉", className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200" });
          setIsUserDialogOpen(false);
          resetUserForm();
          setReferralCodeValidation({ isValid: true, message: '' });
        } else {
          toast({
            title: "Error al actualizar",
            description: buildValidationMessage(result, "No se pudo actualizar el usuario"),
            variant: "destructive",
            className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
          });
        }
      } else {
        if (userToSave.role === 'referido') {
          const establishmentPayload = {
            business_name: userToSave.business_name,
            owner_name: userToSave.owner_name?.trim() || '',
            whatsapp: userToSave.whatsapp?.trim() || '',
            email: userToSave.email?.trim() || '',
            password: userToSave.password || '',
            city: userToSave.city?.trim() || '',
            address: userToSave.address?.trim() || '',
            lat: userToSave.lat ?? null,
            lng: userToSave.lng ?? null,
            nit: userToSave.nit?.trim() || '',
            notes: userToSave.notes?.trim() || '',
            chamber_of_commerce: userToSave.chamber_of_commerce || null,
            rut: userToSave.rut || null,
            logo: userToSave.logo || null,
            citizenship_card: userToSave.citizenship_card || null,
          };

          result = await sellerReferralService.create(establishmentPayload);
          if (result.success) {
            toast({
              title: "Establecimiento creado",
              description: "El establecimiento quedó creado con su usuario de acceso y su link.",
              className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200"
            });
            setIsUserDialogOpen(false);
            resetUserForm();
            await reloadUsers?.();
          } else {
            toast({
              title: "Error al crear",
              description: buildValidationMessage(result, "No se pudo crear el establecimiento"),
              variant: "destructive",
              className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
            });
          }
          return;
        }

        // Generar código único de referido para nuevas piojólogas
        if (userToSave.role === 'piojologa') {
          try {
            // Generar código único simple
            const timestamp = Date.now().toString(36);
            const randomStr = Math.random().toString(36).substr(2, 5).toUpperCase();
            const uniqueCode = `${userToSave.name?.substring(0,3).toUpperCase() || 'REF'}${randomStr}${timestamp.substr(-2)}`;
            
            userToSave.referral_code = uniqueCode;
            toast({
              title: "🎯 Código generado",
              description: `Código único asignado: ${uniqueCode}`,
              className: "bg-yellow-100 text-yellow-800 rounded-2xl border-2 border-yellow-200"
            });
          } catch (error) {
            console.warn('Error generando código único:', error);
            // Continuar sin código único - no es crítico
          }
        }

        result = await handleCreateUser(userToSave);
        if (result.success) {
          toast({ title: "¡Nuevo Amigo Añadido! 🎈", className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200" });
          setIsUserDialogOpen(false);
          resetUserForm();
          setReferralCodeValidation({ isValid: true, message: '' });
        } else {
          toast({
            title: "Error al crear",
            description: buildValidationMessage(result, "No se pudo crear el usuario"),
            variant: "destructive",
            className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
          });
        }
      }
    } catch (error) {
      console.error('Error al procesar usuario:', error);
      toast({
        title: "Error",
        description: "Hubo un error procesando el usuario",
        variant: "destructive",
        className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
      });
    } finally {
      setIsGeocodifying(false);
    }
  };

  // Earnings Logic
  const handleMarkServiceAsPaid = async (serviceId, piojologistId, piojologistName, amount, clientName, serviceType, serviceDate) => {
    try {
      // Buscar el appointment completo
      const appointment = appointments.find(apt => apt.id === serviceId);
      if (!appointment) {
        toast({
          title: "❌ Error",
          description: "No se encontró el servicio",
          variant: "destructive"
        });
        return;
      }

      const isBoldPaidService = (appointment.customerPaymentProvider || appointment.customer_payment_provider) === 'bold'
        && (appointment.customerPaymentStatus || appointment.customer_payment_status) === 'paid';
      if (isBoldPaidService) {
        toast({
          title: "ℹ️ Pago gestionado por Bold",
          description: "Este servicio ya quedó registrado como pagado por Bold y no requiere pago manual.",
          className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200"
        });
        if (typeof reloadBookings === 'function') {
          await reloadBookings();
        }
        return;
      }

      // Obtener el ID correcto para la API (backendId, bookingId o id)
      const backendId = appointment.backendId || appointment.bookingId || appointment.id;
      
      // Actualizar en la base de datos primero
      const result = await bookingService.update(backendId, {
        payment_status_to_piojologist: 'paid'
      });

      if (!result.success) {
        toast({
          title: "❌ Error al guardar",
          description: result.message || "No se pudo guardar el pago en la base de datos",
          variant: "destructive"
        });
        return;
      }

      // Solo si la API respondió exitosamente, actualizar el estado local
      const updatedAppointments = appointments.map(apt => 
        apt.id === serviceId 
          ? { 
              ...apt, 
              payment_status_to_piojologist: 'paid',
              paymentStatusToPiojologist: 'paid'
            }
          : apt
      );
      
      if (typeof updateAppointments === 'function') {
        updateAppointments(updatedAppointments);
      }

      // Recargar bookings desde el backend para asegurar sincronización
      if (typeof reloadBookings === 'function') {
        await reloadBookings();
      }

      toast({
        title: "💰 Servicio Pagado",
        description: `Se marcó como pagado el servicio de ${piojologistName} por ${formatCurrency(amount)}`,
        className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200"
      });

    } catch (error) {
      console.error('Error marcando servicio como pagado:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo marcar el servicio como pagado",
        variant: "destructive"
      });
    }
  };

  const handleRevertServicePayment = async (serviceId, piojologistId, piojologistName, amount, clientName, serviceType, serviceDate) => {
    try {
      const appointment = appointments.find(apt => apt.id === serviceId);
      if (!appointment) {
        toast({
          title: "❌ Error",
          description: "No se encontró el servicio",
          variant: "destructive"
        });
        return;
      }

      const isBoldPaidService = (appointment.customerPaymentProvider || appointment.customer_payment_provider) === 'bold'
        && (appointment.customerPaymentStatus || appointment.customer_payment_status) === 'paid';
      if (isBoldPaidService) {
        toast({
          title: "ℹ️ Pago protegido",
          description: "Los servicios pagados por Bold no se pueden revertir desde este módulo.",
          className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200"
        });
        if (typeof reloadBookings === 'function') {
          await reloadBookings();
        }
        return;
      }

      const backendId = appointment.backendId || appointment.bookingId || appointment.id;
      const result = await bookingService.update(backendId, {
        payment_status_to_piojologist: 'pending'
      });

      if (!result.success) {
        toast({
          title: "❌ Error al revertir",
          description: result.message || "No se pudo revertir el pago en la base de datos",
          variant: "destructive"
        });
        return;
      }

      const updatedAppointments = appointments.map(apt =>
        apt.id === serviceId
          ? {
              ...apt,
              payment_status_to_piojologist: 'pending',
              paymentStatusToPiojologist: 'pending'
            }
          : apt
      );

      if (typeof updateAppointments === 'function') {
        updateAppointments(updatedAppointments);
      }

      if (typeof reloadBookings === 'function') {
        await reloadBookings();
      }

      toast({
        title: "↩️ Pago revertido",
        description: `El servicio de ${piojologistName} volvió a pendiente por ${formatCurrency(amount)}`,
        className: "bg-amber-100 text-amber-800 rounded-2xl border-2 border-amber-200"
      });
    } catch (error) {
      console.error('Error revirtiendo pago de servicio:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo revertir el pago del servicio",
        variant: "destructive"
      });
    }
  };

  // Product Logic
  const handleProductSubmit = (e) => {
    e.preventDefault();
    
    if (editingProduct) {
      // Editar producto existente
      const updatedProducts = products.map(p => 
        p.id === editingProduct.id 
          ? {
              ...p,
              name: productFormData.name,
              price: parseFloat(productFormData.price),
              stock: parseInt(productFormData.stock),
              image: productFormData.image || p.image
            }
          : p
      );
      updateProducts(updatedProducts);
      toast({ title: "¡Producto Actualizado! ✨", className: "bg-pink-100 text-pink-800 rounded-2xl border-2 border-pink-200" });
    } else {
      // Crear nuevo producto
      const newProduct = {
        id: Date.now(),
        name: productFormData.name,
        price: parseFloat(productFormData.price),
        stock: parseInt(productFormData.stock),
        image: productFormData.image || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
      };
      updateProducts([...products, newProduct]);
      toast({ title: "¡Producto en Estantería! 🛍️", className: "bg-pink-100 text-pink-800 rounded-2xl border-2 border-pink-200" });
    }
    
    setIsProductDialogOpen(false);
    resetProductForm();
  };

  const handleOpenProductDialog = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setProductFormData({
        name: product.name,
        price: product.price.toString(),
        stock: product.stock.toString(),
        image: product.image
      });
    } else {
      resetProductForm();
    }
    setIsProductDialogOpen(true);
  };

  const handleDeleteProduct = (prodId) => {
    updateProducts(products.filter(p => p.id !== prodId));
  };

  // Service Catalog Logic
  const handleOpenServiceDialog = (service = null) => {
    if (service) {
      setEditingService(service);
      setServiceCatalogFormData({
        name: service.name,
        value: service.value.toString()
      });
    } else {
      setEditingService(null);
      setServiceCatalogFormData({
        name: '',
        value: ''
      });
    }
    setIsServiceDialogOpen(true);
  };

  const handleServiceCatalogSubmit = async (e) => {
    e.preventDefault();
    
    const serviceData = {
      name: serviceCatalogFormData.name.trim(),
      value: parseFloat(serviceCatalogFormData.value)
    };

    if (editingService) {
      // Actualizar servicio existente
      const result = await onUpdateService(editingService.id, serviceData);
      if (result) {
        toast({ 
          title: "✨ Servicio Actualizado", 
          description: `${serviceData.name} ahora vale ${toMoney(serviceData.value)}`,
          className: "bg-emerald-100 text-emerald-800 rounded-2xl border-2 border-emerald-200" 
        });
      }
    } else {
      // Crear nuevo servicio
      const result = await onCreateService(serviceData);
      if (result) {
        toast({ 
          title: "🌟 Servicio Creado", 
          description: `${serviceData.name} agregado al catálogo`,
          className: "bg-emerald-100 text-emerald-800 rounded-2xl border-2 border-emerald-200" 
        });
      }
    }
    
    setIsServiceDialogOpen(false);
    setEditingService(null);
    setServiceCatalogFormData({ name: '', value: '' });
  };

  const handleDeleteServiceWithConfirm = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    setItemToDelete(service);
    setDeleteType('service');
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteService = async () => {
    if (itemToDelete && deleteType === 'service') {
      const result = await onDeleteService(itemToDelete.id);
      if (result && result.success) {
        toast({ 
          title: "🗑️ Servicio Eliminado", 
          description: "El servicio ha sido removido del catálogo",
          className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200" 
        });
      } else {
        toast({ 
          title: "❌ No se puede eliminar", 
          description: result?.message || "El servicio está siendo usado en reservas aceptadas",
          variant: "destructive",
          className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold" 
        });
      }
    }
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
    setDeleteType(null);
  };

  // Appointment Logic
  const handleAssignPiojologist = async (appointmentId, piojologistId, appointmentArg = null) => {
    const piojologist = piojologists.find(p => p.id === parseInt(piojologistId));
    const appointment = appointmentArg || appointments.find(a => a.id === appointmentId || a.backendId === appointmentId || a.bookingId === appointmentId);
    const servicePrice = getServicePrice(appointment);
    const backendId = appointment?.backendId || appointment?.bookingId || appointmentId;
    
    // Actualizar en el backend (solo si viene de bookings públicos o tiene backendId)
    try {
      let assignedSnapshot = appointment;

      if (appointment?.isPublicBooking || appointment?.backendId || appointmentId?.toString().startsWith('booking-')) {
        const result = await bookingService.update(backendId, {
          piojologistId: parseInt(piojologistId),
          status: 'assigned'
        });

        if (!result.success) {
          toast({
            title: "Error",
            description: result.message || "No se pudo asignar la piojóloga",
            variant: "destructive",
            className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200"
          });
          return;
        }

        // Actualizar bookings
        if (updateBookings) {
          const updatedBookings = bookings.map(apt => 
            (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) 
              ? { 
                  ...apt, 
                  piojologistId: parseInt(piojologistId),
                  piojologistName: piojologist?.name || null,
                  status: 'assigned',
                  estimatedPrice: servicePrice
                } 
              : apt
          );
          assignedSnapshot = updatedBookings.find(apt => apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) || assignedSnapshot;
          updateBookings(updatedBookings);
        }
      } else {
        const baseList = (baseAppointments && baseAppointments.length) ? baseAppointments : appointments.filter(a => !a.isPublicBooking);
        const updatedInternal = baseList.map(apt => 
          (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) 
            ? { 
                ...apt, 
                piojologistId: parseInt(piojologistId),
                piojologistName: piojologist?.name || null,
                status: 'assigned',
                estimatedPrice: servicePrice
              } 
            : apt
        );
        assignedSnapshot = updatedInternal.find(apt => apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) || assignedSnapshot;
        updateAppointments(updatedInternal);
      }
      
      // Create notification for the piojologist
      if (onNotify) {
        onNotify({
          type: 'assignment',
          appointmentId: appointmentId,
          piojologistId: parseInt(piojologistId),
          message: `Nuevo agendamiento asignado: ${assignedSnapshot?.clientName || appointment?.clientName} - ${assignedSnapshot?.serviceType || appointment?.serviceType}`,
          appointment: assignedSnapshot
        });
      }

      // Disparar evento personalizado para actualización en tiempo real
      window.dispatchEvent(new CustomEvent('serviceAssigned', {
        detail: {
          appointmentId: appointmentId,
          piojologistId: parseInt(piojologistId),
          appointment: assignedSnapshot,
          timestamp: Date.now()
        }
      }));
      
      toast({
        title: "¡Asignación Mágica! ✨",
        description: `${piojologist?.name} va al rescate. Esperando aceptación...`,
        className: "bg-purple-100 text-purple-800 rounded-2xl border-2 border-purple-200"
      });
    } catch (error) {
      console.error('Error al asignar piojóloga:', error);
      toast({
        title: "Error",
        description: "Hubo un problema al asignar la piojóloga",
        variant: "destructive",
        className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200"
      });
    }
  };

  const handleAssignFromCalendar = (appointment, piojologistId) => {
    handleAssignPiojologist(appointment?.backendId || appointment?.bookingId || appointment?.id, piojologistId, appointment);
  };

  const isEstablishmentForm = userFormData.role === 'referido';

  return (
    <div className="w-full space-y-8 overflow-x-hidden">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[235px_minmax(0,1fr)] gap-4">
          <aside className={`${isNavOpen ? 'block' : 'hidden'} lg:block`}>
            <div className="bg-white/60 border-2 border-orange-100 rounded-[1.5rem] p-3 sticky top-4">
              <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2">Modulos</p>
              <TabsList className="w-full h-auto flex flex-col items-stretch bg-transparent p-0 gap-2">
                <TabsTrigger value="dashboard" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-orange-400 data-[state=active]:text-white transition-all">
                  📊 Panel
                </TabsTrigger>
                <TabsTrigger value="schedule" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-yellow-400 data-[state=active]:text-white transition-all">
                  📅 Agendamientos
                </TabsTrigger>
                <TabsTrigger value="users" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-blue-400 data-[state=active]:text-white transition-all">
                  👥 Usuarios
                </TabsTrigger>
                <TabsTrigger value="map" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-cyan-400 data-[state=active]:text-white transition-all">
                  🗺️ Mapa
                </TabsTrigger>
                <TabsTrigger value="geolocation" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-sky-500 data-[state=active]:text-white transition-all">
                  📡 Geolocalización
                </TabsTrigger>
                <TabsTrigger value="products" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-pink-400 data-[state=active]:text-white transition-all">
                  🛍️ Productos
                </TabsTrigger>
                <TabsTrigger value="services" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-emerald-400 data-[state=active]:text-white transition-all">
                  💼 Servicios
                </TabsTrigger>
                <TabsTrigger value="earnings" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-green-400 data-[state=active]:text-white transition-all">
                  💰 Ganancias
                </TabsTrigger>
                <TabsTrigger value="requests" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-purple-400 data-[state=active]:text-white transition-all">
                  📦 Solicitudes
                </TabsTrigger>
                <TabsTrigger value="seller-referrals" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-cyan-500 data-[state=active]:text-white transition-all">
                  🤝 Referidos
                </TabsTrigger>
                <TabsTrigger value="seller-visits" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all">
                  🗂️ Visitas vendedores
                </TabsTrigger>
                <TabsTrigger value="messaging" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-teal-500 data-[state=active]:text-white transition-all">
                  💬 Mensajería
                </TabsTrigger>
                <TabsTrigger value="settings" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-slate-500 data-[state=active]:text-white transition-all">
                  ⚙️ Configuración
                </TabsTrigger>
              </TabsList>
            </div>
          </aside>
          <section className="space-y-6">
            <div className="md:hidden flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                className="h-8 rounded-full text-orange-700 bg-orange-100/90 hover:bg-orange-200 px-3 shadow-sm"
                onClick={() => setIsNavOpen(prev => !prev)}
                aria-expanded={isNavOpen}
                aria-label="Mostrar u ocultar modulos"
              >
                <Menu className="w-4 h-4 mr-2" />
                {isNavOpen ? 'Ocultar modulos' : 'Mostrar modulos'}
              </Button>
            </div>
        <TabsContent value="dashboard" className="space-y-6">
          <DashboardModule
            appointments={appointments}
            users={users}
            piojologists={piojologists}
            formatCurrency={formatCurrency}
            getServicePrice={getServicePrice}
            focusRequest={dashboardFocus}
          />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <ScheduleManagement
            appointments={displayAppointments}
            piojologists={piojologists}
            serviceCatalog={serviceCatalog}
            formatCurrency={formatCurrency}
            reloadBookings={reloadBookings}
            requireAdvance12hSetting={bookingRequireAdvance12h}
            onToggleRequireAdvance12h={handleToggleBookingAdvance12h}
            bookingSettingsLoading={bookingSettingsLoading}
            onAssignFromCalendar={handleAssignFromCalendar}
            onDeleteBooking={onDeleteBooking}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <UsersModule
              users={users}
              handleOpenUserDialog={handleOpenUserDialog}
              handleOpenEstablishmentDialog={handleOpenEstablishmentDialog}
              handleOpenUserDetail={handleOpenUserDetail}
              handleToggleUserActive={handleToggleUserActive}
              handleOpenEarningsModal={handleOpenEarningsModal}
              handleOpenUserStats={handleOpenUserStats}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <ProductsModule
              products={products}
              formatCurrency={formatCurrency}
              handleProductSubmit={handleProductSubmit}
              handleDeleteProduct={handleDeleteProduct}
              productFormData={productFormData}
              setProductFormData={setProductFormData}
              isProductDialogOpen={isProductDialogOpen}
              setIsProductDialogOpen={setIsProductDialogOpen}
              setSelectedProduct={setSelectedProduct}
              setIsProductDetailOpen={setIsProductDetailOpen}
              formatPriceInput={formatPriceInput}
              handlePriceChange={handlePriceChange}
              getImageUrl={getImageUrl}
              handleImageUpload={handleImageUpload}
              handleRemoveImage={handleRemoveImage}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <ServicesModule
              services={services}
              toMoney={toMoney}
              onOpenServiceDialog={handleOpenServiceDialog}
              onDeleteService={handleDeleteServiceWithConfirm}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="earnings" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <EarningsModule
              piojologists={piojologists}
              appointments={appointments}
              users={users}
              serviceCatalog={serviceCatalog}
              referralPayouts={earningsHistory}
              referralCommissionsList={referralCommissionsList}
              getServicePrice={getServicePrice}
              formatCurrency={formatCurrency}
              handleMarkServiceAsPaid={handleMarkServiceAsPaid}
              handleRevertServicePayment={handleRevertServicePayment}
              openPayDialog={openPayDialog}
              setOpenPayDialog={setOpenPayDialog}
              openHistoryDialog={openHistoryDialog}
              setOpenHistoryDialog={setOpenHistoryDialog}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="map" className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-cyan-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-cyan-100 text-cyan-600 rounded-full">
                  <Map className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-800">
                  Mapa de Piojólogas y Establecimientos
                </h3>
              </div>
              <div className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-bold self-start sm:self-auto">
                🎯 {users.filter(u => (u.role === 'piojologa' && u.lat && u.lng) || (u.role === 'referido' && (u.managed_seller_referral?.address || u.managedSellerReferral?.address || u.address))).length} ubicaciones
              </div>
            </div>
            
            <div className="h-[400px] sm:h-[500px] md:h-[600px] rounded-2xl overflow-hidden">
              <PiojologistMap key={users.length} piojologists={users} />
            </div>

            <div className="mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-cyan-50 p-3 sm:p-4 rounded-2xl border-2 border-cyan-200">
                <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-bold">📍 Nota:</span> Los establecimientos usan la dirección fija registrada.
                </p>
              </div>
              <div className="bg-green-50 p-3 sm:p-4 rounded-2xl border-2 border-green-200">
                <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-bold">💡 Tip:</span> Usa el autocomplete al crear piojólogas o establecimientos para ubicaciones precisas.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="geolocation" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <GeolocationModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <RequestsModule
              productRequests={productRequests}
              resolveRequestTotals={resolveRequestTotals}
              formatCurrency={formatCurrency}
              onApproveRequest={onApproveRequest}
              onRejectRequest={onRejectRequest}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="seller-referrals" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <SellerReferralsModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="seller-visits" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <SellerVisitsModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="messaging" className="space-y-6">
          <MessagingModule currentUser={currentUser} users={users} isAdmin />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center text-xl">
                ⚙️
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-800">Configuración</h3>
                <p className="text-sm font-bold text-gray-500">Control global de mensajes y reglas del sistema.</p>
              </div>
            </div>

            <Tabs value={settingsTab} onValueChange={handleSettingsTabChange} className="space-y-6">
              <TabsList className="grid grid-cols-2 xl:grid-cols-5 bg-slate-50 border-2 border-slate-200 rounded-2xl p-2 h-auto gap-2">
                <TabsTrigger value="agenda" className="rounded-xl py-3 font-black data-[state=active]:bg-slate-500 data-[state=active]:text-white">Agenda</TabsTrigger>
                <TabsTrigger value="vendedores" className="rounded-xl py-3 font-black data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Vendedores</TabsTrigger>
                <TabsTrigger value="establecimientos" className="rounded-xl py-3 font-black data-[state=active]:bg-sky-500 data-[state=active]:text-white">Establecimientos</TabsTrigger>
                <TabsTrigger value="mensajes" className="rounded-xl py-3 font-black data-[state=active]:bg-teal-500 data-[state=active]:text-white">Mensajes</TabsTrigger>
                <TabsTrigger value="terminos" className="rounded-xl py-3 font-black data-[state=active]:bg-rose-500 data-[state=active]:text-white">Términos</TabsTrigger>
              </TabsList>

              <TabsContent value="agenda" className="space-y-4">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 md:p-5 space-y-4">
                  <div>
                    <p className="text-xs font-black text-amber-600 uppercase tracking-wide">Submódulo</p>
                    <h4 className="text-xl font-black text-amber-800">Agenda</h4>
                    <p className="text-sm font-bold text-amber-700">
                      Controla la regla global de anticipación mínima para crear agendamientos.
                    </p>
                  </div>

                  <div className="bg-white border-2 border-amber-200 rounded-2xl p-4 md:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-gray-800">Agendamiento con anticipación de 12 horas</p>
                      <p className="text-xs text-gray-500 font-bold mt-1">
                        Si está activo, el sistema no permitirá reservar con menos de 12 horas de diferencia.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleToggleBookingAdvance12h(!bookingRequireAdvance12h)}
                      disabled={bookingSettingsLoading}
                      className={`${bookingRequireAdvance12h ? 'bg-amber-500 hover:bg-amber-600 border-amber-700' : 'bg-slate-500 hover:bg-slate-600 border-slate-700'} text-white font-black rounded-xl px-5`}
                    >
                      {bookingSettingsLoading ? 'Guardando...' : bookingRequireAdvance12h ? 'Activo' : 'Inactivo'}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="vendedores" className="space-y-4">
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 md:p-5 space-y-4">
                  <div>
                    <p className="text-xs font-black text-emerald-600 uppercase tracking-wide">Submódulo</p>
                    <h4 className="text-xl font-black text-emerald-800">Vendedores</h4>
                    <p className="text-sm font-bold text-emerald-700">
                      Define la comisión global por cabeza agendada desde los links de vendedores. Si un vendedor tiene valor propio, ese valor tendrá prioridad.
                    </p>
                  </div>

                  <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 space-y-3">
                    <label className="block text-sm font-black text-gray-700">Valor global por cabeza (COP)</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={sellerReferralValueDraft}
                      onChange={(e) => setSellerReferralValueDraft(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full rounded-2xl border-2 border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:border-emerald-400"
                      placeholder="5000"
                    />
                    <p className="text-xs text-gray-500 font-bold">
                      Este valor se usa como predeterminado para todos los vendedores que no tengan un valor personalizado.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={handleSaveSellerReferralSettings}
                      disabled={sellerReferralSettingsSaving}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl px-5"
                    >
                      {sellerReferralSettingsSaving ? 'Guardando...' : 'Guardar comisión global de vendedores'}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="establecimientos" className="space-y-4">
                <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 md:p-5 space-y-4">
                  <div>
                    <p className="text-xs font-black text-sky-600 uppercase tracking-wide">Submódulo</p>
                    <h4 className="text-xl font-black text-sky-800">Establecimientos</h4>
                    <p className="text-sm font-bold text-sky-700">
                      Define la comisión mensual por tramos para los establecimientos referidos. El corte se guarda por mes calendario.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {partnerCommissionTiersDraft.map((tier, index) => (
                      <div key={tier.id || index} className="bg-white border-2 border-sky-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-black text-gray-700 mb-2">Desde</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={tier.from}
                            onChange={(e) => handlePartnerTierChange(index, 'from', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full rounded-2xl border-2 border-sky-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:border-sky-400"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-black text-gray-700 mb-2">Hasta</label>
                          <input
                            type="number"
                            min={tier.from || 1}
                            step="1"
                            value={tier.to ?? ''}
                            onChange={(e) => handlePartnerTierChange(index, 'to', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full rounded-2xl border-2 border-sky-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:border-sky-400"
                            placeholder={index === partnerCommissionTiersDraft.length - 1 ? 'Sin límite' : ''}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-black text-gray-700 mb-2">Comisión (COP)</label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={tier.value}
                            onChange={(e) => handlePartnerTierChange(index, 'value', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full rounded-2xl border-2 border-sky-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:border-sky-400"
                          />
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 font-bold">
                      El último tramo puede quedar sin límite en el campo "Hasta". El sistema aplicará estos valores según la cantidad de referidos del mes por establecimiento.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={handleSavePartnerCommissionSettings}
                      disabled={partnerCommissionSettingsSaving}
                      className="bg-sky-500 hover:bg-sky-600 text-white font-black rounded-xl px-5"
                    >
                      {partnerCommissionSettingsSaving ? 'Guardando...' : 'Guardar comisión de establecimientos'}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mensajes" className="space-y-4">
                <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-4 md:p-5 space-y-4">
                  <div>
                    <p className="text-xs font-black text-teal-600 uppercase tracking-wide">Submódulo</p>
                    <h4 className="text-xl font-black text-teal-800">Mensajes</h4>
                    <p className="text-sm font-bold text-teal-700">
                      Este mensaje se usa en el botón de WhatsApp del agendamiento público confirmado.
                    </p>
                  </div>

                  <div className="bg-white border-2 border-teal-200 rounded-2xl p-4 space-y-3">
                    <label className="block text-sm font-black text-gray-700">Plantilla del mensaje</label>
                    <textarea
                      value={whatsappTemplateDraft}
                      onChange={(e) => setWhatsappTemplateDraft(e.target.value)}
                      className="w-full min-h-[320px] rounded-2xl border-2 border-teal-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:border-teal-400 resize-y"
                      placeholder="Escribe el mensaje que se enviará por WhatsApp"
                    />
                    <p className="text-xs text-gray-500 font-bold">
                      Variables disponibles: {SMS_TEMPLATE_VARIABLES.join(', ')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={handleSaveSmsSettings}
                      disabled={smsSettingsSaving}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-black rounded-xl px-5"
                    >
                      {smsSettingsSaving ? 'Guardando...' : 'Guardar configuración SMS'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetSmsTemplate}
                      className="border-2 border-teal-200 text-teal-700 hover:bg-teal-100 font-black rounded-xl px-5"
                    >
                      Restaurar plantilla predeterminada
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="terminos" className="space-y-4">
                <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 md:p-5 space-y-4">
                  <div>
                    <p className="text-xs font-black text-rose-600 uppercase tracking-wide">Submódulo</p>
                    <h4 className="text-xl font-black text-rose-800">Términos y condiciones</h4>
                    <p className="text-sm font-bold text-rose-700">
                      Configura el texto que verán piojólogas, vendedores y establecimientos desde su panel.
                    </p>
                  </div>

                  <Tabs value={termsRoleTab} onValueChange={handleTermsRoleTabChange} className="space-y-4">
                    <TabsList className="grid grid-cols-1 md:grid-cols-3 bg-white border-2 border-rose-200 rounded-2xl p-2 h-auto gap-2">
                      <TabsTrigger value="piojologa" className="rounded-xl py-3 font-black data-[state=active]:bg-fuchsia-500 data-[state=active]:text-white">Piojóloga</TabsTrigger>
                      <TabsTrigger value="vendedor" className="rounded-xl py-3 font-black data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Vendedor</TabsTrigger>
                      <TabsTrigger value="referido" className="rounded-xl py-3 font-black data-[state=active]:bg-sky-500 data-[state=active]:text-white">Establecimiento</TabsTrigger>
                    </TabsList>

                    {Object.keys(TERMS_ROLE_LABELS).map((roleKey) => (
                      <TabsContent key={roleKey} value={roleKey} className="space-y-4">
                        <div className="bg-white border-2 border-rose-200 rounded-2xl p-4 space-y-3">
                          <div>
                            <p className="text-sm font-black text-gray-800">{TERMS_ROLE_LABELS[roleKey]}</p>
                            <p className="text-xs text-gray-500 font-bold mt-1">{TERMS_ROLE_DESCRIPTIONS[roleKey]}</p>
                          </div>
                          <textarea
                            value={termsSettingsDraft[roleKey] || ''}
                            onChange={(e) => handleTermsDraftChange(roleKey, e.target.value)}
                            className="w-full min-h-[320px] rounded-2xl border-2 border-rose-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:border-rose-400 resize-y"
                            placeholder={`Escribe los términos y condiciones para ${TERMS_ROLE_LABELS[roleKey].toLowerCase()}`}
                          />
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={handleSaveTermsSettings}
                      disabled={termsSettingsSaving}
                      className="bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl px-5"
                    >
                      {termsSettingsSaving ? 'Guardando...' : 'Guardar términos y condiciones'}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
          </section>
        </div>
      </Tabs>

      {/* User Dialog Modal */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-blue-400 p-0 overflow-hidden sm:max-w-md bg-blue-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingUser ? 'Editar Miembro' : isEstablishmentForm ? 'Nuevo Establecimiento' : 'Nuevo Miembro'}</DialogTitle>
          </DialogHeader>
          {/* Title */}
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              {isEstablishmentForm ? <Building2 className="w-6 h-6 text-blue-600" /> : <User className="w-6 h-6 text-blue-600" />}
              <h2 className="text-2xl font-black text-blue-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                {editingUser ? (isEstablishmentForm ? 'EDITAR ESTABLECIMIENTO' : 'EDITAR MIEMBRO') : isEstablishmentForm ? 'NUEVO ESTABLECIMIENTO' : 'NUEVO MIEMBRO'}
              </h2>
            </div>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto">
            <form onSubmit={handleUserSubmit} className="px-8 pb-8 space-y-4">
            {!isEstablishmentForm && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Nombre del Cliente</label>
                <input 
                  required
                  className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                  value={userFormData.name}
                  onChange={e => setUserFormData({...userFormData, name: e.target.value})}
                  placeholder="Ej. Familia Pérez"
                />
              </div>
            )}
            
            <div className={`grid gap-4 ${isEstablishmentForm ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Rol</label>
                <select 
                  className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all"
                  value={userFormData.role}
                  onChange={e => {
                    const nextRole = e.target.value;
                    const currentRole = userFormData.role;
                    setUserFormData({
                      ...userFormData,
                      role: nextRole,
                      referral_value: nextRole === 'piojologa'
                        ? Number(currentRole === 'piojologa' ? (userFormData.referral_value ?? 15000) : 15000)
                        : nextRole === 'vendedor'
                          ? Number(currentRole === 'vendedor' ? (userFormData.referral_value ?? sellerReferralValueDraft) : sellerReferralValueDraft)
                          : userFormData.referral_value
                    });
                  }}
                >
                  <option value="piojologa">🦸 Piojóloga</option>
                  <option value="vendedor">💼 Vendedor</option>
                  <option value="referido">🏪 Establecimiento</option>
                  <option value="admin">👑 Administrador</option>
                </select>
              </div>
              {!isEstablishmentForm && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Contraseña {editingUser && <span className="text-xs text-gray-400">(mantener actual)</span>}
                  </label>
                  <input 
                    required={!editingUser}
                    type="password"
                    className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                    value={userFormData.password}
                    onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                    placeholder={editingUser ? "Dejar vacío si no cambia" : "***"}
                  />
                </div>
              )}
            </div>

            {isEstablishmentForm ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Nombre del establecimiento *</label>
                  <input
                    required
                    className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                    value={userFormData.business_name}
                    onChange={e => setUserFormData({
                      ...userFormData,
                      business_name: e.target.value,
                      name: e.target.value
                    })}
                    placeholder="Ej. Peluquería Brillo Perfecto"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Propietario</label>
                    <input
                      className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                      value={userFormData.owner_name}
                      onChange={e => setUserFormData({...userFormData, owner_name: e.target.value})}
                      placeholder="Nombre del dueño"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">WhatsApp *</label>
                    <input
                      required
                      className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                      value={userFormData.whatsapp}
                      onChange={e => setUserFormData({...userFormData, whatsapp: e.target.value})}
                      placeholder="3001234567"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Correo de acceso *</label>
                    <div className="flex items-center gap-3 rounded-2xl border-2 border-blue-400 bg-white p-4">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <input
                        required
                        type="email"
                        className="w-full bg-transparent text-gray-700 outline-none"
                        value={userFormData.email}
                        onChange={e => setUserFormData({...userFormData, email: e.target.value})}
                        placeholder="contacto@establecimiento.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      {editingUser ? 'Nueva contraseña' : 'Contraseña inicial *'}
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border-2 border-blue-400 bg-white p-4">
                      <Lock className="w-4 h-4 text-blue-600" />
                      <input
                        required={!editingUser}
                        type="text"
                        className="w-full bg-transparent text-gray-700 outline-none"
                        value={userFormData.password}
                        onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                        placeholder={editingUser ? "Déjala vacía para conservar la actual" : "Mínimo 6 caracteres"}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Ciudad</label>
                    <input
                      className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                      value={userFormData.city}
                      onChange={e => setUserFormData({...userFormData, city: e.target.value})}
                      placeholder="Ciudad"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">NIT</label>
                    <input
                      className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                      value={userFormData.nit}
                      onChange={e => setUserFormData({...userFormData, nit: e.target.value})}
                      placeholder="Identificación tributaria"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Observaciones</label>
                  <textarea
                    rows={3}
                    className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400 resize-none"
                    value={userFormData.notes}
                    onChange={e => setUserFormData({...userFormData, notes: e.target.value})}
                    placeholder="Notas comerciales, condiciones o comentarios relevantes"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block rounded-2xl border-2 border-dashed border-blue-300 bg-white p-4 cursor-pointer">
                    <span className="block text-sm font-black text-blue-700 mb-2">Cámara de Comercio</span>
                    <span className="block text-xs text-gray-500 font-bold mb-3">PDF o imagen, máximo 5 MB</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setUserFormData({...userFormData, chamber_of_commerce: e.target.files?.[0] || null})}
                    />
                    <span className="inline-flex items-center gap-2 text-sm font-black text-blue-700">
                      <FileText className="w-4 h-4" />
                      {userFormData.chamber_of_commerce ? userFormData.chamber_of_commerce.name : 'Seleccionar archivo'}
                    </span>
                    {editingUser?.chamber_of_commerce_url ? <a href={editingUser.chamber_of_commerce_url} target="_blank" rel="noreferrer" className="block mt-2 text-xs font-black text-blue-700 underline">Ver archivo actual</a> : null}
                  </label>
                  <label className="block rounded-2xl border-2 border-dashed border-blue-300 bg-white p-4 cursor-pointer">
                    <span className="block text-sm font-black text-blue-700 mb-2">RUT</span>
                    <span className="block text-xs text-gray-500 font-bold mb-3">PDF o imagen, máximo 5 MB</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setUserFormData({...userFormData, rut: e.target.files?.[0] || null})}
                    />
                    <span className="inline-flex items-center gap-2 text-sm font-black text-blue-700">
                      <FileText className="w-4 h-4" />
                      {userFormData.rut ? userFormData.rut.name : 'Seleccionar archivo'}
                    </span>
                    {editingUser?.rut_url ? <a href={editingUser.rut_url} target="_blank" rel="noreferrer" className="block mt-2 text-xs font-black text-blue-700 underline">Ver archivo actual</a> : null}
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block rounded-2xl border-2 border-dashed border-blue-300 bg-white p-4 cursor-pointer">
                    <span className="block text-sm font-black text-blue-700 mb-2">Foto del logo</span>
                    <span className="block text-xs text-gray-500 font-bold mb-3">JPG, PNG o WEBP, máximo 5 MB</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(e) => setUserFormData({...userFormData, logo: e.target.files?.[0] || null})}
                    />
                    <span className="inline-flex items-center gap-2 text-sm font-black text-blue-700">
                      <FileText className="w-4 h-4" />
                      {userFormData.logo ? userFormData.logo.name : 'Seleccionar archivo'}
                    </span>
                    {editingUser?.logo_url ? <a href={editingUser.logo_url} target="_blank" rel="noreferrer" className="block mt-2 text-xs font-black text-blue-700 underline">Ver archivo actual</a> : null}
                  </label>

                  <label className="block rounded-2xl border-2 border-dashed border-blue-300 bg-white p-4 cursor-pointer">
                    <span className="block text-sm font-black text-blue-700 mb-2">Foto de la Cédula de ciudadanía</span>
                    <span className="block text-xs text-gray-500 font-bold mb-3">JPG, PNG o WEBP, máximo 5 MB</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(e) => setUserFormData({...userFormData, citizenship_card: e.target.files?.[0] || null})}
                    />
                    <span className="inline-flex items-center gap-2 text-sm font-black text-blue-700">
                      <FileText className="w-4 h-4" />
                      {userFormData.citizenship_card ? userFormData.citizenship_card.name : 'Seleccionar archivo'}
                    </span>
                    {editingUser?.citizenship_card_url ? <a href={editingUser.citizenship_card_url} target="_blank" rel="noreferrer" className="block mt-2 text-xs font-black text-blue-700 underline">Ver archivo actual</a> : null}
                  </label>
                </div>
              </motion.div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Email</label>
                <input 
                  required
                  type="email"
                  className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                  value={userFormData.email}
                  onChange={e => setUserFormData({...userFormData, email: e.target.value})}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            )}

            {!isEstablishmentForm && (userFormData.role === 'piojologa' || userFormData.role === 'vendedor') && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-4">
                {userFormData.role === 'piojologa' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Especialidad (Súper Poder)</label>
                    <input 
                      className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                      value={userFormData.specialty || ''}
                      onChange={e => setUserFormData({...userFormData, specialty: e.target.value})}
                      placeholder="Ej. Visión de Rayos X"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    {userFormData.role === 'vendedor' ? '💸 Valor por cabeza referida (COP)' : '💸 Valor referido (COP)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                    value={userFormData.referral_value ?? (userFormData.role === 'vendedor' ? sellerReferralValueDraft : 15000)}
                    onChange={e => setUserFormData({
                      ...userFormData,
                      referral_value: e.target.value === '' ? '' : Number(e.target.value)
                    })}
                    placeholder={userFormData.role === 'vendedor' ? String(sellerReferralValueDraft || 5000) : "15000"}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {userFormData.role === 'vendedor'
                      ? `Por defecto: ${formatCurrency(sellerReferralValueDraft || 5000)}. Puedes personalizarlo por vendedor.`
                      : `Por defecto: ${formatCurrency(15000)}. Puedes personalizarlo por piojóloga.`}
                  </p>
                </div>

                {/* Código de Referido Usado */}
                {!editingUser && userFormData.role === 'piojologa' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      🎁 Código de Referido <span className="text-xs text-gray-400">(opcional)</span>
                    </label>
                    <input 
                      className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                      value={userFormData.referral_code_used || ''}
                      onChange={async (e) => {
                        const code = e.target.value.toUpperCase();
                        setUserFormData({...userFormData, referral_code_used: code});
                        
                        // Validar código si no está vacío
                        if (code.trim()) {
                          try {
                            const isValid = await referralService.validateCode(code);
                            setReferralCodeValidation({
                              isValid,
                              message: isValid ? '✅ Código válido' : '❌ Código no válido'
                            });
                          } catch (error) {
                            setReferralCodeValidation({
                              isValid: false,
                              message: '❌ Error al validar código'
                            });
                          }
                        } else {
                          setReferralCodeValidation({ isValid: true, message: '' });
                        }
                      }}
                      placeholder="Ej. MARIA2024"
                    />
                    {referralCodeValidation.message && (
                      <p className={`text-xs mt-2 font-medium ${referralCodeValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                        {referralCodeValidation.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Código de Referido Propio */}
                {editingUser && (userFormData.role === 'piojologa' || userFormData.role === 'vendedor') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      🔗 Código de Referido Único
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <input 
                          className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 font-mono text-lg font-bold text-gray-700 outline-none focus:border-blue-500 transition-all h-14"
                          value={userFormData.referral_code || ''}
                          readOnly
                          placeholder="Se genera automáticamente"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => handleRegenerateReferralCode(editingUser.id)}
                        className="flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-2xl w-14 h-14 shadow-lg transition-all"
                        title="Regenerar Código"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {userFormData.role === 'vendedor'
                        ? 'Este código alimenta el link directo que el vendedor comparte con sus clientes.'
                        : 'Este código puede ser usado por otras piojólogas para referenciarla.'}
                    </p>
                  </div>
                )}

                {editingUser && userFormData.role === 'vendedor' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      🌐 Link de Referido del Vendedor
                    </label>
                    <div className="flex flex-col lg:flex-row gap-3">
                      <div className="flex-1">
                        <input
                          className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 font-bold outline-none h-14"
                          value={buildReferralBookingLink(userFormData.referral_code)}
                          readOnly
                          placeholder="Primero genera el código de referido"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => handleCopyReferralLink(userFormData.referral_code)}
                        disabled={!userFormData.referral_code}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl px-5 h-14 font-black shadow-lg disabled:opacity-50"
                      >
                        Copiar link
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Este link abre la agenda pública con el referido del vendedor aplicado automáticamente.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {userFormData.role === 'piojologa' && !isEstablishmentForm && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">📍 Dirección</label>
                <AddressAutocomplete
                  value={userFormData.address || ''}
                  onChange={(address) => setUserFormData({...userFormData, address})}
                  onSelect={(suggestion) => {
                    setUserFormData({
                      ...userFormData,
                      address: suggestion.fullName,
                      lat: suggestion.lat,
                      lng: suggestion.lng
                    });
                    toast({
                      title: "📍 Ubicación seleccionada",
                      description: `${suggestion.name}`,
                      className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200"
                    });
                  }}
                />
              </div>
            )}

            {userFormData.role !== 'piojologa' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">📍 Dirección {isEstablishmentForm ? '' : '(Opcional)'}</label>
                <AddressAutocomplete
                  value={userFormData.address || ''}
                  onChange={(address) => setUserFormData({...userFormData, address})}
                  onSelect={(suggestion) => {
                    setUserFormData({
                      ...userFormData,
                      address: suggestion.fullName || suggestion.displayName,
                      lat: suggestion.lat,
                      lng: suggestion.lng
                    });
                    toast({
                      title: "📍 Ubicación seleccionada",
                      description: `${suggestion.name || suggestion.displayName}`,
                      className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200"
                    });
                  }}
                />
              </div>
            )}

            <div className="pt-6">
              <Button 
                type="submit"
                disabled={isGeocodifying}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-3xl py-4 px-6 font-bold text-lg shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGeocodifying ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Localizando...
                  </>
                ) : (
                  editingUser ? 'Guardar Cambios' : isEstablishmentForm ? 'Crear Establecimiento' : 'Crear y Asignar Miembro'
                )}
              </Button>
            </div>
          </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Suspense fallback={<div>Cargando...</div>}>
        <ProductDetailDialog
          isOpen={isProductDetailOpen}
          onClose={setIsProductDetailOpen}
          product={selectedProduct}
          formatCurrency={formatCurrency}
          onEdit={(product) => {
            setIsProductDetailOpen(false);
            handleOpenProductDialog(product);
          }}
          onDelete={(productId) => {
            handleDeleteProduct(productId);
            setIsProductDetailOpen(false);
          }}
        />
      </Suspense>

      {/* User Detail Dialog */}
      <Suspense fallback={<div>Cargando...</div>}>
        <UserDetailDialog
          isOpen={isUserDetailOpen}
          onClose={() => setIsUserDetailOpen(false)}
          user={detailUser}
          formatCurrency={formatCurrency}
          formatDate12H={formatDate12H}
          onEdit={(user) => {
            setIsUserDetailOpen(false);
            handleOpenUserDialog(user);
          }}
        />
      </Suspense>

      {/* Earnings Dialog */}
      <Suspense fallback={<div>Cargando...</div>}>
        <EarningsDialog
          isOpen={showEarningsModal}
          onClose={() => setShowEarningsModal(false)}
          piojologists={piojologists}
          appointments={appointments}
          users={users}
          formatCurrency={formatCurrency}
          formatDate12H={formatDate12H}
          earningsHistory={earningsHistory}
          referralCommissionsList={referralCommissionsList}
          loadingEarnings={loadingEarnings}
          handlePayAll={handlePayAll}
          handlePayOneReferral={handlePayOneReferral}
        />
      </Suspense>

      {/* Service Catalog Dialog */}
      <Suspense fallback={<div>Cargando...</div>}>
        <ServiceCatalogDialog
          isOpen={isServiceDialogOpen}
          onClose={() => {
            setIsServiceDialogOpen(false);
            setEditingService(null);
            setServiceCatalogFormData({ name: '', value: '' });
          }}
          editingService={editingService}
          formData={serviceCatalogFormData}
          setFormData={setServiceCatalogFormData}
          onSubmit={handleServiceCatalogSubmit}
        />
      </Suspense>

      {/* Delete Confirmation Dialog */}
      <Suspense fallback={<div>Cargando...</div>}>
        <DeleteConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setItemToDelete(null);
            setDeleteType(null);
          }}
          onConfirm={() => {
            if (deleteType === 'service') {
              confirmDeleteService();
            } else if (deleteType === 'product') {
              handleDeleteProduct(itemToDelete?.id || itemToDelete);
              setDeleteConfirmOpen(false);
              setItemToDelete(null);
              setDeleteType(null);
            }
          }}
          item={itemToDelete}
          itemType={deleteType === 'service' ? 'servicio' : 'producto'}
        />
      </Suspense>
    </div>
  );
};

export default AdminView;


