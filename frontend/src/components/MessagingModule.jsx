import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileText,
  Image as ImageIcon,
  Inbox,
  Mail,
  MessageSquare,
  RefreshCw,
  Reply,
  Send,
  UserRound,
  Users,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { messagingService } from '@/lib/api';
import Pagination from '@/components/admin/Pagination';

const ROLE_LABELS = {
  admin: 'Administrador',
  piojologa: 'Piojologa',
  vendedor: 'Vendedor',
  referido: 'Establecimiento',
};

const TARGET_ROLE_OPTIONS = ['piojologa', 'vendedor', 'referido'];
const MESSAGES_PER_PAGE = 6;

const STATUS_STYLES = {
  pending: { label: 'Pendiente', badge: 'bg-amber-100 border-amber-200 text-amber-700' },
  replied: { label: 'Respondido', badge: 'bg-emerald-100 border-emerald-200 text-emerald-700' },
  sent: { label: 'Enviado', badge: 'bg-sky-100 border-sky-200 text-sky-700' },
};

const roleLabel = (role) => ROLE_LABELS[role] || role || 'Usuario';
const isImage = (type) => String(type || '').startsWith('image/');
const isAdminOutbound = (item) => item?.sender?.role === 'admin' && !!item?.recipient;

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleString('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
};

const extractErrorMessage = (result, fallback) => {
  if (result?.errors && typeof result.errors === 'object') {
    const firstKey = Object.keys(result.errors)[0];
    const firstMessage = Array.isArray(result.errors[firstKey]) ? result.errors[firstKey][0] : result.errors[firstKey];
    if (firstMessage) return firstMessage;
  }

  return result?.message || fallback;
};

const getCounterpart = (item, isAdminView) => {
  if (isAdminView) {
    if (isAdminOutbound(item)) {
      return {
        title: item?.recipient?.name || 'Destinatario',
        subtitle: `${roleLabel(item?.recipient?.role)}${item?.recipient?.email ? ` - ${item.recipient.email}` : ''}`,
      };
    }

    return {
      title: item?.sender?.name || 'Usuario',
      subtitle: `${roleLabel(item?.sender?.role)}${item?.sender?.email ? ` - ${item.sender.email}` : ''}`,
    };
  }

  if (isAdminOutbound(item)) {
    return {
      title: 'Administracion',
      subtitle: item?.recipient?.id ? 'Mensaje dirigido a tu cuenta' : 'Comunicacion administrativa',
    };
  }

  return {
    title: 'Mensaje enviado a administracion',
    subtitle: `${roleLabel(item?.sender?.role)}${item?.sender?.email ? ` - ${item.sender.email}` : ''}`,
  };
};

const getUserFilterLabel = (value) => {
  if (value === 'pending') return 'Pendientes';
  if (value === 'replied') return 'Respondidos';
  if (value === 'sent') return 'Recibidos';
  return 'Todos';
};

const AttachmentLink = ({ item }) => {
  if (!item?.attachment_url) return null;

  return (
    <a
      href={item.attachment_url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 hover:bg-slate-100"
    >
      <span className="flex min-w-0 items-center gap-3">
        {isImage(item.attachment_type) ? <ImageIcon className="h-5 w-5 text-cyan-600" /> : <FileText className="h-5 w-5 text-cyan-600" />}
        <span className="truncate">{item.attachment_name || 'Adjunto'}</span>
      </span>
      <Download className="h-5 w-5 text-cyan-600" />
    </a>
  );
};

const SectionCard = ({ icon, eyebrow, title, description, children, className = '' }) => {
  const Icon = icon;

  return (
    <div className={`rounded-[2rem] border-4 border-cyan-100 bg-white p-5 md:p-6 shadow-lg ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-black text-gray-800">{title}</h3>
          {description ? <p className="mt-2 text-sm font-bold text-gray-500">{description}</p> : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
};

const FilterTabs = ({ filters, activeFilter, onChange, getCount, getLabel }) => (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {filters.map((value) => (
      <button
        key={value}
        type="button"
        onClick={() => onChange(value)}
        className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border-2 px-4 py-2 text-sm font-black transition-colors ${
          activeFilter === value
            ? 'border-cyan-500 bg-cyan-500 text-white'
            : 'border-cyan-100 bg-cyan-50 text-cyan-700 hover:bg-white'
        }`}
      >
        <span>{getLabel(value)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${activeFilter === value ? 'bg-white/20 text-white' : 'bg-white text-cyan-700'}`}>
          {getCount(value)}
        </span>
      </button>
    ))}
  </div>
);

const MessageRecordCard = ({ item, isAdminView, onOpen }) => {
  const status = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
  const counterpart = getCounterpart(item, isAdminView);
  const preview = String(item.description || '').trim();
  const summary = preview.length > 140 ? `${preview.slice(0, 140)}...` : preview;

  return (
    <article className="rounded-[1.75rem] border-2 border-cyan-100 bg-white p-4 shadow-sm transition-colors hover:bg-cyan-50/40">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-gray-800">{counterpart.title}</p>
              <p className="mt-1 text-sm font-bold text-gray-500 break-words">{counterpart.subtitle}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-wide text-gray-400">{formatDateTime(item.created_at)}</p>
            </div>
          </div>

          <p className="text-sm font-bold leading-6 text-gray-700">{summary || 'Sin contenido'}</p>

          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${status.badge}`}>
              {status.label}
            </span>
            {item.attachment_url ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
                Con adjunto
              </span>
            ) : null}
            {!isAdminView && item.admin_reply ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                Con respuesta
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-start">
          <Button type="button" onClick={() => onOpen(item)} className="rounded-2xl bg-cyan-500 px-4 py-2 font-black text-white hover:bg-cyan-600">
            <MessageSquare className="mr-2 h-4 w-4" />
            Ver detalles
          </Button>
        </div>
      </div>
    </article>
  );
};

const AdminMessageComposer = ({ users, onSubmitted }) => {
  const { toast } = useToast();
  const [targetMode, setTargetMode] = useState('role');
  const [targetRole, setTargetRole] = useState('piojologa');
  const [targetUserId, setTargetUserId] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentKey, setAttachmentKey] = useState(0);
  const [sending, setSending] = useState(false);

  const nonAdminUsers = useMemo(() => (users || []).filter((item) => item?.role && item.role !== 'admin'), [users]);
  const roleCount = useMemo(() => nonAdminUsers.filter((item) => item.role === targetRole).length, [nonAdminUsers, targetRole]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!description.trim()) return;
    if (targetMode === 'user' && !targetUserId) return;

    setSending(true);
    const result = await messagingService.create({
      description: description.trim(),
      attachment,
      recipient_user_id: targetMode === 'user' ? targetUserId : null,
      target_role: targetMode === 'role' ? targetRole : null,
    });
    setSending(false);

    if (!result.success) {
      toast({
        title: 'Error',
        description: extractErrorMessage(result, 'No se pudo enviar el mensaje'),
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    setDescription('');
    setAttachment(null);
    setAttachmentKey((current) => current + 1);
    await onSubmitted?.();
    toast({
      title: 'Mensaje enviado',
      description: result.message || 'El mensaje fue enviado correctamente.',
      className: 'rounded-3xl border-4 border-emerald-200 bg-emerald-50 text-emerald-700 font-bold'
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border-4 border-cyan-100 bg-white p-5 md:p-6 shadow-lg space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">Mensaje saliente</p>
          <h3 className="mt-2 text-xl font-black text-gray-800">Enviar comunicacion</h3>
          <p className="mt-2 text-sm font-bold text-gray-500">Selecciona un rol completo o una cuenta puntual y envia el mensaje con un soporte adjunto si hace falta.</p>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTargetMode('role')}
            className={`rounded-xl px-4 py-2 text-sm font-black ${targetMode === 'role' ? 'bg-cyan-500 text-white' : 'border-2 border-cyan-200 bg-white text-cyan-700'}`}
          >
            Por rol
          </button>
          <button
            type="button"
            onClick={() => setTargetMode('user')}
            className={`rounded-xl px-4 py-2 text-sm font-black ${targetMode === 'user' ? 'bg-cyan-500 text-white' : 'border-2 border-cyan-200 bg-white text-cyan-700'}`}
          >
            Usuario puntual
          </button>
        </div>

        {targetMode === 'role' ? (
          <>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-cyan-400"
            >
              {TARGET_ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{roleLabel(role)}</option>
              ))}
            </select>
            <p className="text-xs font-bold text-gray-500">Se enviara a {roleCount} usuario(s) del rol {roleLabel(targetRole).toLowerCase()}.</p>
          </>
        ) : (
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="w-full rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-cyan-400"
          >
            <option value="">Selecciona un usuario</option>
            {nonAdminUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} - {roleLabel(user.role)}
              </option>
            ))}
          </select>
        )}
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-[180px] w-full rounded-[1.5rem] border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-cyan-400"
        placeholder="Escribe aqui el mensaje que quieres enviar."
      />

      <input
        key={attachmentKey}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
        onChange={(e) => setAttachment(e.target.files?.[0] || null)}
        className="block w-full rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-black file:text-white"
      />

      <Button type="submit" disabled={sending} className="w-full rounded-2xl bg-cyan-500 py-4 text-base font-black text-white shadow-md hover:bg-cyan-600">
        <Send className="mr-2 h-5 w-5" />
        {sending ? 'Enviando...' : 'Enviar mensaje'}
      </Button>
    </form>
  );
};

const UserMessageComposer = ({ pendingCount, onSubmitted }) => {
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentKey, setAttachmentKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    const result = await messagingService.create({ description: description.trim(), attachment });
    setIsSubmitting(false);

    if (!result.success) {
      toast({
        title: 'Error',
        description: extractErrorMessage(result, 'No se pudo enviar el mensaje'),
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    setDescription('');
    setAttachment(null);
    setAttachmentKey((current) => current + 1);
    await onSubmitted?.();
    toast({
      title: 'Mensaje enviado',
      description: 'Administracion recibio tu mensaje correctamente.',
      className: 'rounded-3xl border-4 border-emerald-200 bg-emerald-50 text-emerald-700 font-bold'
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border-4 border-cyan-100 bg-white p-5 md:p-6 shadow-lg space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600">
          <Mail className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">Nuevo mensaje</p>
          <h3 className="mt-2 text-xl font-black text-gray-800">Escribir a administracion</h3>
          <p className="mt-2 text-sm font-bold text-gray-500">
            {pendingCount > 0
              ? `Tienes ${pendingCount} mensaje(s) pendiente(s) por respuesta.`
              : 'Tus respuestas y notificaciones tambien apareceran aqui.'}
          </p>
        </div>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-[180px] w-full rounded-[1.5rem] border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-cyan-400"
        placeholder="Cuéntale a administracion que necesitas o que ocurrio."
      />

      <input
        key={attachmentKey}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
        onChange={(e) => setAttachment(e.target.files?.[0] || null)}
        className="block w-full rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-black file:text-white"
      />

      <Button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-cyan-500 py-4 text-base font-black text-white shadow-md hover:bg-cyan-600">
        <Send className="mr-2 h-5 w-5" />
        {isSubmitting ? 'Enviando mensaje...' : 'Enviar a administracion'}
      </Button>
    </form>
  );
};

const MessageDetail = ({ item, isAdminView, onRefresh, onClose }) => {
  const { toast } = useToast();
  const [replyDraft, setReplyDraft] = useState(item?.admin_reply || '');
  const [isSendingReply, setIsSendingReply] = useState(false);

  useEffect(() => {
    setReplyDraft(item?.admin_reply || '');
  }, [item?.id, item?.admin_reply]);

  if (!item) return null;

  const outbound = isAdminOutbound(item);
  const status = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
  const counterpart = getCounterpart(item, isAdminView);
  const canReply = isAdminView && !outbound;

  const sendReply = async () => {
    if (!item?.id || !replyDraft.trim()) return;

    setIsSendingReply(true);
    const result = await messagingService.reply(item.id, { admin_reply: replyDraft.trim() });
    setIsSendingReply(false);

    if (!result.success) {
      toast({
        title: 'Error',
        description: extractErrorMessage(result, 'No se pudo enviar la respuesta'),
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    toast({
      title: 'Respuesta enviada',
      description: 'El usuario ya puede ver tu respuesta.',
      className: 'rounded-3xl border-4 border-emerald-200 bg-emerald-50 text-emerald-700 font-bold'
    });
    await onRefresh?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">
            {outbound ? 'Registro saliente' : 'Detalle del mensaje'}
          </p>
          <h3 className="text-2xl font-black text-gray-800 break-words">{counterpart.title}</h3>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700">{counterpart.subtitle}</span>
            <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${status.badge}`}>{status.label}</span>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide font-black text-cyan-600">{outbound ? 'Enviado' : 'Registrado'}</p>
          <p className="mt-1 text-sm font-bold text-gray-700">{formatDateTime(item.created_at)}</p>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4">
        <p className="text-xs uppercase tracking-wide font-black text-cyan-600">{outbound ? 'Mensaje enviado' : 'Mensaje'}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm font-bold leading-6 text-gray-700">{item.description}</p>
      </div>

      <AttachmentLink item={item} />

      {!isAdminView && item.admin_reply ? (
        <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-wide font-black text-emerald-600">Respuesta de administracion</p>
          <p className="mt-3 whitespace-pre-wrap text-sm font-bold leading-6 text-gray-700">{item.admin_reply}</p>
          {item.replied_at ? <p className="mt-3 text-xs font-black uppercase tracking-wide text-emerald-600">Respondido {formatDateTime(item.replied_at)}</p> : null}
        </div>
      ) : null}

      {!isAdminView && !item.admin_reply && !outbound ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
          Tu mensaje sigue en revision por administracion.
        </div>
      ) : null}

      {isAdminView && outbound ? (
        <div className="rounded-2xl border-2 border-sky-100 bg-sky-50 p-4 text-sm font-bold text-sky-700">
          Este es un mensaje saliente enviado por administracion. No requiere respuesta desde este flujo.
        </div>
      ) : null}

      {canReply ? (
        <div className="rounded-[1.75rem] border-4 border-emerald-100 bg-emerald-50 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Reply className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] font-black text-emerald-600">Responder</p>
              <p className="mt-1 text-sm font-bold text-emerald-700">La respuesta quedara visible en el panel del usuario.</p>
            </div>
          </div>

          <textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            className="min-h-[180px] w-full rounded-[1.5rem] border-2 border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-emerald-400"
            placeholder="Escribe aqui la respuesta para el usuario."
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {onClose ? (
              <Button type="button" variant="outline" onClick={onClose} className="rounded-2xl border-2 border-slate-200 bg-white">
                Cerrar
              </Button>
            ) : null}
            <Button type="button" onClick={sendReply} disabled={isSendingReply} className="rounded-2xl bg-emerald-500 px-5 py-3 font-black text-white hover:bg-emerald-600">
              <Send className="mr-2 h-4 w-4" />
              {isSendingReply ? 'Enviando...' : item.admin_reply ? 'Actualizar respuesta' : 'Enviar respuesta'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-2xl border-2 border-slate-200 bg-white">
            Cerrar
          </Button>
        </div>
      )}
    </div>
  );
};

const MessagingRecords = ({ items, isAdminView, onOpenDetail }) => {
  if (items.length === 0) {
    return (
      <div className="rounded-[1.75rem] border-4 border-dashed border-cyan-200 bg-cyan-50 p-10 text-center">
        <Inbox className="mx-auto h-10 w-10 text-cyan-500" />
        <p className="mt-4 text-lg font-black text-cyan-700">No hay registros en esta vista</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <MessageRecordCard key={item.id} item={item} isAdminView={isAdminView} onOpen={onOpenDetail} />
      ))}
    </div>
  );
};

const AdminMessagingModule = ({ users, messages, isLoading, onRefresh }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filters = ['all', 'pending', 'replied', 'sent'];
  const filteredMessages = useMemo(
    () => (statusFilter === 'all' ? messages : messages.filter((item) => item.status === statusFilter)),
    [messages, statusFilter]
  );
  const paginatedMessages = useMemo(
    () => filteredMessages.slice((currentPage - 1) * MESSAGES_PER_PAGE, currentPage * MESSAGES_PER_PAGE),
    [currentPage, filteredMessages]
  );
  const visibleStart = filteredMessages.length === 0 ? 0 : ((currentPage - 1) * MESSAGES_PER_PAGE) + 1;
  const visibleEnd = Math.min(currentPage * MESSAGES_PER_PAGE, filteredMessages.length);

  const getCount = (filter) => (filter === 'all' ? messages.length : messages.filter((item) => item.status === filter).length);
  const getLabel = (value) => {
    if (value === 'pending') return 'Pendientes';
    if (value === 'replied') return 'Respondidos';
    if (value === 'sent') return 'Salientes';
    return 'Todos';
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredMessages.length]);

  return (
    <div className="space-y-6">
      <AdminMessageComposer users={users} onSubmitted={onRefresh} />

      <SectionCard
        icon={Users}
        eyebrow="Buzon administrativo"
        title="Mensajeria"
        description="Revisa los registros recibidos y abre el detalle solo cuando necesites responder o ver soportes."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterTabs
            filters={filters}
            activeFilter={statusFilter}
            onChange={setStatusFilter}
            getCount={getCount}
            getLabel={getLabel}
          />

          <Button type="button" onClick={onRefresh} className="rounded-2xl bg-cyan-500 px-5 py-3 font-bold text-white shadow-sm hover:bg-cyan-600">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <div className="mt-5">
          {filteredMessages.length > 0 ? (
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-gray-600">Mostrando {visibleStart}-{visibleEnd} de {filteredMessages.length} registros</p>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-600">Pagina {currentPage}</p>
            </div>
          ) : null}

          <MessagingRecords items={paginatedMessages} isAdminView onOpenDetail={setSelectedMessage} />

          <Pagination
            currentPage={currentPage}
            totalItems={filteredMessages.length}
            itemsPerPage={MESSAGES_PER_PAGE}
            onPageChange={setCurrentPage}
            colorScheme="cyan"
          />
        </div>
      </SectionCard>

      <Dialog open={Boolean(selectedMessage)} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <DialogContent className="rounded-[2rem] border-4 border-cyan-200 bg-white p-0 overflow-hidden sm:max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle del mensaje</DialogTitle>
          </DialogHeader>
          {selectedMessage ? (
            <div className="max-h-[85vh] overflow-y-auto p-6 md:p-8">
              <MessageDetail item={selectedMessage} isAdminView onRefresh={onRefresh} onClose={() => setSelectedMessage(null)} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const UserMessagingModule = ({ messages, isLoading, pendingCount, onRefresh, className = '' }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filters = ['all', 'pending', 'replied', 'sent'];
  const filteredMessages = useMemo(() => {
    if (statusFilter === 'all') return messages;
    return messages.filter((item) => item.status === statusFilter);
  }, [messages, statusFilter]);
  const paginatedMessages = useMemo(
    () => filteredMessages.slice((currentPage - 1) * MESSAGES_PER_PAGE, currentPage * MESSAGES_PER_PAGE),
    [currentPage, filteredMessages]
  );
  const visibleStart = filteredMessages.length === 0 ? 0 : ((currentPage - 1) * MESSAGES_PER_PAGE) + 1;
  const visibleEnd = Math.min(currentPage * MESSAGES_PER_PAGE, filteredMessages.length);

  const getCount = (filter) => {
    if (filter === 'all') return messages.length;
    return messages.filter((item) => item.status === filter).length;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredMessages.length]);

  return (
    <div className={`space-y-6 ${className}`}>
      <UserMessageComposer pendingCount={pendingCount} onSubmitted={onRefresh} />

      <SectionCard
        icon={Inbox}
        eyebrow="Historial"
        title="Mensajeria"
        description="Tus mensajes, respuestas de administracion y comunicados recibidos aparecen como registros claros y faciles de revisar."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterTabs
            filters={filters}
            activeFilter={statusFilter}
            onChange={setStatusFilter}
            getCount={getCount}
            getLabel={getUserFilterLabel}
          />

          <Button type="button" onClick={onRefresh} className="rounded-2xl bg-cyan-500 px-5 py-3 font-bold text-white shadow-sm hover:bg-cyan-600">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <div className="mt-5">
          {filteredMessages.length > 0 ? (
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-gray-600">Mostrando {visibleStart}-{visibleEnd} de {filteredMessages.length} registros</p>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-600">Pagina {currentPage}</p>
            </div>
          ) : null}

          <MessagingRecords items={paginatedMessages} isAdminView={false} onOpenDetail={setSelectedMessage} />

          <Pagination
            currentPage={currentPage}
            totalItems={filteredMessages.length}
            itemsPerPage={MESSAGES_PER_PAGE}
            onPageChange={setCurrentPage}
            colorScheme="cyan"
          />
        </div>
      </SectionCard>

      <Dialog open={Boolean(selectedMessage)} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <DialogContent className="rounded-[2rem] border-4 border-cyan-200 bg-white p-0 overflow-hidden sm:max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle del mensaje</DialogTitle>
          </DialogHeader>
          {selectedMessage ? (
            <div className="max-h-[85vh] overflow-y-auto p-6 md:p-8">
              <MessageDetail item={selectedMessage} isAdminView={false} onRefresh={onRefresh} onClose={() => setSelectedMessage(null)} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MessagingModule = ({ currentUser, isAdmin = false, users = [], className = '' }) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMessages = async () => {
    setIsLoading(true);
    const result = await messagingService.getAll();
    setIsLoading(false);

    if (!result.success) {
      toast({
        title: 'Error',
        description: result.message || 'No se pudieron cargar los mensajes',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    setMessages(result.messages || []);
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const pendingCount = useMemo(() => messages.filter((item) => item.status === 'pending').length, [messages]);

  if (isAdmin) {
    return <AdminMessagingModule currentUser={currentUser} users={users} messages={messages} isLoading={isLoading} onRefresh={loadMessages} />;
  }

  return (
    <UserMessagingModule
      messages={messages}
      isLoading={isLoading}
      pendingCount={pendingCount}
      onRefresh={loadMessages}
      className={className}
    />
  );
};

export default MessagingModule;
