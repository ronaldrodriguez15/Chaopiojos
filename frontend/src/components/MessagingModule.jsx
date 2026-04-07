import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Inbox, Mail, MessageSquare, RefreshCw, Reply, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { messagingService } from '@/lib/api';

const ROLE_LABELS = { admin: 'Administrador', piojologa: 'Piojóloga', vendedor: 'Vendedor', referido: 'Establecimiento' };
const TARGET_ROLE_OPTIONS = ['piojologa', 'vendedor', 'referido'];
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
  try { return new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return value; }
};
const extractErrorMessage = (result, fallback) => {
  if (result?.errors && typeof result.errors === 'object') {
    const firstKey = Object.keys(result.errors)[0];
    const firstMessage = Array.isArray(result.errors[firstKey]) ? result.errors[firstKey][0] : result.errors[firstKey];
    if (firstMessage) return firstMessage;
  }
  return result?.message || fallback;
};

const AttachmentLink = ({ item }) => {
  if (!item?.attachment_url) return null;
  return (
    <a href={item.attachment_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 hover:bg-slate-100">
      <span className="flex min-w-0 items-center gap-3">
        {isImage(item.attachment_type) ? <ImageIcon className="h-5 w-5 text-cyan-600" /> : <FileText className="h-5 w-5 text-cyan-600" />}
        <span className="truncate">{item.attachment_name || 'Adjunto'}</span>
      </span>
      <Download className="h-5 w-5 text-cyan-600" />
    </a>
  );
};

const MessageCard = ({ item }) => {
  const status = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
  const outbound = isAdminOutbound(item);
  return (
    <div className="rounded-[1.75rem] border-4 border-cyan-100 bg-white p-5 shadow-lg space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">{outbound ? 'Mensaje de administración' : 'Mensaje enviado'}</p>
          <p className="text-sm font-bold text-gray-500 mt-1">{formatDateTime(item.created_at)}</p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${status.badge}`}>{status.label}</span>
      </div>
      <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4">
        <p className="text-xs uppercase tracking-wide font-black text-cyan-600">Descripción</p>
        <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-gray-700">{item.description}</p>
      </div>
      <AttachmentLink item={item} />
      {!outbound && item.admin_reply ? (
        <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-wide font-black text-emerald-600">Respuesta de administración</p>
          <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-gray-700">{item.admin_reply}</p>
        </div>
      ) : null}
      {!outbound && !item.admin_reply ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">
          Tu mensaje está en revisión por administración.
        </div>
      ) : null}
    </div>
  );
};

const AdminMessagingModule = ({ currentUser, users, messages, isLoading, onRefresh }) => {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyingId, setReplyingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [targetMode, setTargetMode] = useState('role');
  const [targetRole, setTargetRole] = useState('piojologa');
  const [targetUserId, setTargetUserId] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentKey, setAttachmentKey] = useState(0);
  const [sending, setSending] = useState(false);

  const nonAdminUsers = useMemo(() => (users || []).filter((item) => item?.role && item.role !== 'admin'), [users]);
  const filtered = useMemo(() => (statusFilter === 'all' ? messages : messages.filter((item) => item.status === statusFilter)), [messages, statusFilter]);
  const selected = useMemo(() => filtered.find((item) => item.id === selectedId) || filtered[0] || null, [filtered, selectedId]);
  const canReply = selected && !isAdminOutbound(selected);
  const roleCount = useMemo(() => nonAdminUsers.filter((item) => item.role === targetRole).length, [nonAdminUsers, targetRole]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      setReplyDraft('');
      return;
    }
    if (!selectedId || !filtered.some((item) => item.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  useEffect(() => {
    setReplyDraft(selected?.admin_reply || '');
  }, [selected?.id, selected?.admin_reply]);

  const sendReply = async () => {
    if (!selected || !canReply || !replyDraft.trim()) return;
    setReplyingId(selected.id);
    const result = await messagingService.reply(selected.id, { admin_reply: replyDraft.trim() });
    setReplyingId(null);
    if (!result.success) {
      toast({ title: 'Error', description: extractErrorMessage(result, 'No se pudo enviar la respuesta'), variant: 'destructive', className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold' });
      return;
    }
    toast({ title: 'Respuesta enviada', description: 'El usuario ya puede ver tu respuesta.', className: 'rounded-3xl border-4 border-emerald-200 bg-emerald-50 text-emerald-700 font-bold' });
    await onRefresh();
  };

  const sendAdminMessage = async (event) => {
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
      toast({ title: 'Error', description: extractErrorMessage(result, 'No se pudo enviar el mensaje'), variant: 'destructive', className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold' });
      return;
    }
    setDescription('');
    setAttachment(null);
    setAttachmentKey((current) => current + 1);
    await onRefresh();
    toast({ title: 'Mensaje enviado', description: result.message || 'El mensaje fue enviado correctamente.', className: 'rounded-3xl border-4 border-emerald-200 bg-emerald-50 text-emerald-700 font-bold' });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[0.88fr_1.12fr] gap-6">
        <form onSubmit={sendAdminMessage} className="rounded-[2rem] border-4 border-cyan-100 bg-white p-5 shadow-lg space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600"><Users className="h-6 w-6" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">Mensaje saliente</p>
              <p className="text-sm font-bold text-gray-500">Envía mensajes a una persona o a un rol completo.</p>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setTargetMode('role')} className={`rounded-xl px-4 py-2 text-sm font-black ${targetMode === 'role' ? 'bg-cyan-500 text-white' : 'bg-white text-cyan-700 border-2 border-cyan-200'}`}>Por rol</button>
              <button type="button" onClick={() => setTargetMode('user')} className={`rounded-xl px-4 py-2 text-sm font-black ${targetMode === 'user' ? 'bg-cyan-500 text-white' : 'bg-white text-cyan-700 border-2 border-cyan-200'}`}>Usuario puntual</button>
            </div>
            {targetMode === 'role' ? (
              <>
                <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="w-full rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-cyan-400">
                  {TARGET_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                </select>
                <p className="text-xs font-bold text-gray-500">Se enviará a {roleCount} usuario(s) del rol {roleLabel(targetRole).toLowerCase()}.</p>
              </>
            ) : (
              <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="w-full rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-cyan-400">
                <option value="">Selecciona un usuario</option>
                {nonAdminUsers.map((user) => <option key={user.id} value={user.id}>{user.name} • {roleLabel(user.role)}</option>)}
              </select>
            )}
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[220px] w-full rounded-[1.5rem] border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-cyan-400" placeholder="Escribe aquí el mensaje que quieres enviar" />
          <input key={attachmentKey} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx" onChange={(e) => setAttachment(e.target.files?.[0] || null)} className="block w-full rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-black file:text-white" />
          <Button type="submit" disabled={sending} className="w-full rounded-2xl bg-cyan-500 py-4 text-base font-black text-white shadow-md hover:bg-cyan-600">
            <Send className="mr-2 h-5 w-5" />
            {sending ? 'Enviando...' : 'Enviar mensaje'}
          </Button>
        </form>

        <div className="rounded-[2rem] border-4 border-cyan-100 bg-white p-5 shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">Buzón administrativo</p>
              <h3 className="mt-2 text-2xl font-black text-gray-800">Mensajería</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-1">
                {['all', 'pending', 'replied', 'sent'].map((value) => (
                  <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${statusFilter === value ? 'bg-cyan-500 text-white' : 'text-cyan-700 hover:bg-white'}`}>
                    {value === 'all' ? 'Todos' : value === 'pending' ? 'Pendientes' : value === 'replied' ? 'Respondidos' : 'Salientes'}
                  </button>
                ))}
              </div>
              <Button type="button" onClick={onRefresh} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl px-5 py-3 font-bold shadow-sm">
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="mt-6 rounded-[2rem] border-4 border-dashed border-cyan-200 bg-cyan-50 p-10 text-center font-bold text-cyan-700">No hay mensajes en esta vista.</div>
          ) : (
            <div className="mt-6 grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
              <div className="rounded-[2rem] border-4 border-cyan-100 bg-white p-4 shadow-sm">
                <div className="space-y-3 max-h-[42rem] overflow-y-auto pr-1">
                  {filtered.map((item) => {
                    const status = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
                    const outbound = isAdminOutbound(item);
                    const selectedClass = selected?.id === item.id ? 'border-cyan-400 bg-cyan-50 shadow-md' : 'border-cyan-100 bg-white hover:bg-cyan-50/60';
                    return (
                      <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-[1.5rem] border-2 p-4 text-left transition-all ${selectedClass}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-black text-gray-800">{outbound ? (item.recipient?.name || 'Destinatario') : (item.sender?.name || 'Usuario')}</p>
                            <p className="truncate text-xs font-bold text-gray-500">{outbound ? `${roleLabel(item.recipient?.role)} • ${item.recipient?.email || 'Sin correo'}` : `${roleLabel(item.sender?.role)} • ${item.sender?.email || 'Sin correo'}`}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${status.badge}`}>{status.label}</span>
                        </div>
                        <p className="mt-3 line-clamp-3 text-sm font-bold text-gray-600">{item.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-[2rem] border-4 border-cyan-100 bg-white p-6 shadow-sm">
                {selected ? (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">{isAdminOutbound(selected) ? 'Mensaje enviado por administración' : 'Conversación'}</p>
                        <h3 className="text-2xl font-black text-gray-800">{isAdminOutbound(selected) ? (selected.recipient?.name || 'Destinatario') : (selected.sender?.name || 'Usuario')}</h3>
                        <div className="flex flex-wrap gap-2 text-xs font-black">
                          <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-700">{isAdminOutbound(selected) ? roleLabel(selected.recipient?.role) : roleLabel(selected.sender?.role)}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{isAdminOutbound(selected) ? (selected.recipient?.email || 'Sin correo') : (selected.sender?.email || 'Sin correo')}</span>
                        </div>
                      </div>
                      <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-wide font-black text-cyan-600">{isAdminOutbound(selected) ? 'Enviado' : 'Recibido'}</p>
                        <p className="mt-1 text-sm font-bold text-gray-700">{formatDateTime(selected.created_at)}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4">
                      <p className="text-xs uppercase tracking-wide font-black text-cyan-600">{isAdminOutbound(selected) ? 'Mensaje enviado' : 'Mensaje recibido'}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-gray-700">{selected.description}</p>
                    </div>
                    <AttachmentLink item={selected} />
                    {canReply ? (
                      <div className="rounded-[1.75rem] border-4 border-emerald-100 bg-emerald-50 p-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <Reply className="h-5 w-5 text-emerald-600" />
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] font-black text-emerald-600">Responder</p>
                            <p className="text-sm font-bold text-emerald-700">La respuesta quedará visible en el panel del usuario.</p>
                          </div>
                        </div>
                        <textarea value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} className="min-h-[220px] w-full rounded-[1.5rem] border-2 border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-emerald-400" placeholder="Escribe aquí la respuesta para el usuario" />
                        <Button type="button" onClick={sendReply} disabled={replyingId === selected.id} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl px-5 py-3 font-black shadow-sm">
                          <Send className="mr-2 h-4 w-4" />
                          {replyingId === selected.id ? 'Enviando...' : selected.admin_reply ? 'Actualizar respuesta' : 'Enviar respuesta'}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-[1.75rem] border-4 border-sky-100 bg-sky-50 p-5 text-sm font-bold text-sky-700">Este es un mensaje saliente enviado por administración.</div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MessagingModule = ({ currentUser, isAdmin = false, users = [], className = '' }) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentKey, setAttachmentKey] = useState(0);

  const loadMessages = async () => {
    setIsLoading(true);
    const result = await messagingService.getAll();
    setIsLoading(false);
    if (!result.success) {
      toast({ title: 'Error', description: result.message || 'No se pudieron cargar los mensajes', variant: 'destructive', className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold' });
      return;
    }
    setMessages(result.messages || []);
  };

  useEffect(() => { loadMessages(); }, []);

  const pendingCount = useMemo(() => messages.filter((item) => item.status === 'pending').length, [messages]);

  const submitUserMessage = async (event) => {
    event.preventDefault();
    if (!description.trim()) return;
    setIsSubmitting(true);
    const result = await messagingService.create({ description: description.trim(), attachment });
    setIsSubmitting(false);
    if (!result.success) {
      toast({ title: 'Error', description: extractErrorMessage(result, 'No se pudo enviar el mensaje'), variant: 'destructive', className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold' });
      return;
    }
    setDescription('');
    setAttachment(null);
    setAttachmentKey((current) => current + 1);
    await loadMessages();
    toast({ title: 'Mensaje enviado', description: 'Administración recibió tu mensaje correctamente.', className: 'rounded-3xl border-4 border-emerald-200 bg-emerald-50 text-emerald-700 font-bold' });
  };

  if (isAdmin) {
    return <AdminMessagingModule currentUser={currentUser} users={users} messages={messages} isLoading={isLoading} onRefresh={loadMessages} />;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="rounded-[2rem] border-4 border-cyan-100 bg-white p-5 md:p-6 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">Módulo</p>
            <h3 className="mt-2 text-2xl font-black text-gray-800">Mensajería</h3>
            <p className="mt-2 text-sm font-bold text-gray-500">Envía dudas o soportes a administración. {pendingCount > 0 ? `Tienes ${pendingCount} mensaje(s) pendiente(s) por respuesta.` : 'Tus respuestas aparecerán aquí mismo.'}</p>
          </div>
          <Button type="button" onClick={loadMessages} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl px-5 py-3 font-bold shadow-sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-6">
        <form onSubmit={submitUserMessage} className="rounded-[2rem] border-4 border-cyan-100 bg-white p-5 md:p-6 shadow-lg space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600"><Mail className="h-6 w-6" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">Nuevo mensaje</p>
              <p className="text-sm font-bold text-gray-500">Se enviará al buzón del administrador.</p>
            </div>
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[220px] w-full rounded-[1.5rem] border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-cyan-400" placeholder="Cuéntale a administración qué necesitas o qué pasó." />
          <input key={attachmentKey} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx" onChange={(e) => setAttachment(e.target.files?.[0] || null)} className="block w-full rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-black file:text-white" />
          <Button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-cyan-500 py-4 text-base font-black text-white shadow-md hover:bg-cyan-600">
            <Send className="mr-2 h-5 w-5" />
            {isSubmitting ? 'Enviando mensaje...' : 'Enviar a administración'}
          </Button>
        </form>
        <div className="rounded-[2rem] border-4 border-cyan-100 bg-white p-5 md:p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600"><Inbox className="h-6 w-6" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] font-black text-cyan-600">Tu historial</p>
              <p className="text-sm font-bold text-gray-500">Aquí verás tus mensajes y los avisos enviados por administración.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4 max-h-[46rem] overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="rounded-[1.75rem] border-4 border-dashed border-cyan-200 bg-cyan-50 p-10 text-center">
                <MessageSquare className="mx-auto h-10 w-10 text-cyan-500" />
                <p className="mt-4 text-lg font-black text-cyan-700">Aún no tienes mensajes</p>
              </div>
            ) : (
              messages.map((item) => <MessageCard key={item.id} item={item} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagingModule;
