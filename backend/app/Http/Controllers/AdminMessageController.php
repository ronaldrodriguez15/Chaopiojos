<?php

namespace App\Http\Controllers;

use App\Models\AdminMessage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class AdminMessageController extends Controller
{
    protected function serializeMessage(AdminMessage $message): array
    {
        return [
            'id' => $message->id,
            'description' => $message->description,
            'status' => $message->status,
            'attachment_path' => $message->attachment_path,
            'attachment_name' => $message->attachment_name,
            'attachment_type' => $message->attachment_type,
            'attachment_url' => $message->attachment_path ? asset('storage/' . $message->attachment_path) : null,
            'admin_reply' => $message->admin_reply,
            'replied_at' => $message->replied_at,
            'created_at' => $message->created_at,
            'updated_at' => $message->updated_at,
            'sender' => $message->relationLoaded('sender') && $message->sender
                ? [
                    'id' => $message->sender->id,
                    'name' => $message->sender->name,
                    'email' => $message->sender->email,
                    'role' => $message->sender->role,
                ]
                : null,
            'recipient' => $message->relationLoaded('recipient') && $message->recipient
                ? [
                    'id' => $message->recipient->id,
                    'name' => $message->recipient->name,
                    'email' => $message->recipient->email,
                    'role' => $message->recipient->role,
                ]
                : null,
            'replier' => $message->relationLoaded('replier') && $message->replier
                ? [
                    'id' => $message->replier->id,
                    'name' => $message->replier->name,
                    'email' => $message->replier->email,
                ]
                : null,
        ];
    }

    protected function storeAttachment(?\Illuminate\Http\UploadedFile $file): array
    {
        if (!$file) {
            return [
                'attachment_path' => null,
                'attachment_name' => null,
                'attachment_type' => null,
            ];
        }

        $extension = $file->getClientOriginalExtension() ?: 'bin';
        $filename = 'admin-messages/message-' . uniqid() . '.' . $extension;
        Storage::disk('public')->putFileAs('admin-messages', $file, basename($filename));

        return [
            'attachment_path' => $filename,
            'attachment_name' => $file->getClientOriginalName(),
            'attachment_type' => $file->getClientMimeType(),
        ];
    }

    protected function sendNewMessageEmails(AdminMessage $message): void
    {
        $adminEmails = User::query()
            ->where('role', 'admin')
            ->whereNotNull('email')
            ->pluck('email')
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (empty($adminEmails)) {
            return;
        }

        $senderName = $message->sender?->name ?: 'Usuario';
        $senderRole = $message->sender?->role ?: 'usuario';
        $body = '
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
                <h2 style="margin-bottom: 12px;">Nuevo mensaje para administración</h2>
                <p><strong>Remitente:</strong> ' . e($senderName) . '</p>
                <p><strong>Correo:</strong> ' . e((string) ($message->sender?->email ?: 'Sin correo')) . '</p>
                <p><strong>Rol:</strong> ' . e($senderRole) . '</p>
                <p><strong>Descripción:</strong></p>
                <div style="padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">' . nl2br(e($message->description)) . '</div>
            </div>
        ';

        try {
            Mail::send([], [], function ($mail) use ($adminEmails, $body, $message, $senderName) {
                $mail->to($adminEmails)
                    ->subject('Nuevo mensaje de mensajería - ' . $senderName)
                    ->html($body);

                if ($message->attachment_path) {
                    $mail->attach(storage_path('app/public/' . $message->attachment_path), [
                        'as' => $message->attachment_name ?: basename($message->attachment_path),
                    ]);
                }
            });
        } catch (\Throwable $exception) {
            Log::warning('No se pudo enviar el correo de nuevo mensaje al admin', [
                'message_id' => $message->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    protected function sendReplyEmail(AdminMessage $message): void
    {
        if (!$message->sender?->email || !$message->admin_reply) {
            return;
        }

        $body = '
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
                <h2 style="margin-bottom: 12px;">Administración respondió tu mensaje</h2>
                <p><strong>Tu mensaje:</strong></p>
                <div style="padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px;">' . nl2br(e($message->description)) . '</div>
                <p><strong>Respuesta:</strong></p>
                <div style="padding: 12px; background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 8px;">' . nl2br(e($message->admin_reply)) . '</div>
            </div>
        ';

        try {
            Mail::send([], [], function ($mail) use ($message, $body) {
                $mail->to($message->sender->email)
                    ->subject('Respuesta de administración - Chao Piojos')
                    ->html($body);
            });
        } catch (\Throwable $exception) {
            Log::warning('No se pudo enviar el correo de respuesta al remitente', [
                'message_id' => $message->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    protected function sendOutboundAdminEmail(AdminMessage $message): void
    {
        if (!$message->recipient?->email) {
            return;
        }

        $senderName = $message->sender?->name ?: 'Administración';
        $body = '
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
                <h2 style="margin-bottom: 12px;">Nuevo mensaje de administración</h2>
                <p><strong>Enviado por:</strong> ' . e($senderName) . '</p>
                <p><strong>Mensaje:</strong></p>
                <div style="padding: 12px; background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 8px;">' . nl2br(e($message->description)) . '</div>
            </div>
        ';

        try {
            Mail::send([], [], function ($mail) use ($message, $body) {
                $mail->to($message->recipient->email)
                    ->subject('Nuevo mensaje de administración - Chao Piojos')
                    ->html($body);

                if ($message->attachment_path) {
                    $mail->attach(storage_path('app/public/' . $message->attachment_path), [
                        'as' => $message->attachment_name ?: basename($message->attachment_path),
                    ]);
                }
            });
        } catch (\Throwable $exception) {
            Log::warning('No se pudo enviar el correo saliente de administración', [
                'message_id' => $message->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no autenticado',
            ], 401);
        }

        $query = AdminMessage::query()
            ->with(['sender:id,name,email,role', 'recipient:id,name,email,role', 'replier:id,name,email']);

        if ($user->role !== 'admin') {
            $query->where(function ($builder) use ($user) {
                $builder
                    ->where('sender_user_id', $user->id)
                    ->orWhere('recipient_user_id', $user->id);
            });
        } else {
            $query->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END");
        }

        $messages = $query
            ->latest('created_at')
            ->get()
            ->map(fn (AdminMessage $message) => $this->serializeMessage($message))
            ->values();

        return response()->json([
            'success' => true,
            'messages' => $messages,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no autenticado',
            ], 401);
        }

        if ($user->role === 'admin') {
            $validated = $request->validate([
                'description' => 'required|string|min:3|max:12000',
                'attachment' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf,doc,docx|max:10240',
                'recipient_user_id' => 'nullable|integer|exists:users,id',
                'target_role' => 'nullable|string|in:piojologa,vendedor,referido',
            ]);

            if (empty($validated['recipient_user_id']) && empty($validated['target_role'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Debes seleccionar un destinatario o un rol destino.',
                ], 422);
            }

            $recipientQuery = User::query()
                ->where('role', '!=', 'admin');

            if (!empty($validated['recipient_user_id'])) {
                $recipientQuery->where('id', (int) $validated['recipient_user_id']);
            } else {
                $recipientQuery
                    ->where('role', $validated['target_role'])
                    ->where(function ($builder) {
                        $builder->where('role', 'admin')->orWhere('is_active', true);
                    });
            }

            $recipients = $recipientQuery->get();

            if ($recipients->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron destinatarios válidos para el mensaje.',
                ], 422);
            }

            $attachmentData = $this->storeAttachment($request->file('attachment'));
            $createdMessages = collect();

            foreach ($recipients as $recipient) {
                $message = AdminMessage::create([
                    'sender_user_id' => $user->id,
                    'recipient_user_id' => $recipient->id,
                    'description' => trim($validated['description']),
                    'attachment_path' => $attachmentData['attachment_path'],
                    'attachment_name' => $attachmentData['attachment_name'],
                    'attachment_type' => $attachmentData['attachment_type'],
                    'status' => 'sent',
                ]);

                $message->load(['sender:id,name,email,role', 'recipient:id,name,email,role', 'replier:id,name,email']);
                $this->sendOutboundAdminEmail($message);
                $createdMessages->push($message);
            }

            return response()->json([
                'success' => true,
                'message' => $recipients->count() === 1
                    ? 'El mensaje fue enviado correctamente.'
                    : 'El mensaje fue enviado al grupo seleccionado.',
                'count' => $createdMessages->count(),
                'admin_message' => $this->serializeMessage($createdMessages->first()),
            ], 201);
        }

        $validated = $request->validate([
            'description' => 'required|string|min:5|max:12000',
            'attachment' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf,doc,docx|max:10240',
        ]);

        $attachmentData = $this->storeAttachment($request->file('attachment'));

        $message = AdminMessage::create([
            'sender_user_id' => $user->id,
            'description' => trim($validated['description']),
            'attachment_path' => $attachmentData['attachment_path'],
            'attachment_name' => $attachmentData['attachment_name'],
            'attachment_type' => $attachmentData['attachment_type'],
            'status' => 'pending',
        ]);

        $message->load(['sender:id,name,email,role', 'recipient:id,name,email,role', 'replier:id,name,email']);
        $this->sendNewMessageEmails($message);

        return response()->json([
            'success' => true,
            'message' => 'Tu mensaje fue enviado a administración.',
            'admin_message' => $this->serializeMessage($message),
        ], 201);
    }

    public function reply(Request $request, int $id)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado',
            ], 403);
        }

        $validated = $request->validate([
            'admin_reply' => 'required|string|min:3|max:12000',
        ]);

        $message = AdminMessage::query()
            ->with(['sender:id,name,email,role', 'recipient:id,name,email,role', 'replier:id,name,email'])
            ->findOrFail($id);

        if ($message->sender_user_id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Los mensajes enviados por administración no requieren respuesta desde este flujo.',
            ], 422);
        }

        $message->admin_reply = trim($validated['admin_reply']);
        $message->status = 'replied';
        $message->replied_by_user_id = $user->id;
        $message->replied_at = now();
        $message->save();

        $message->load(['sender:id,name,email,role', 'recipient:id,name,email,role', 'replier:id,name,email']);
        $this->sendReplyEmail($message);

        return response()->json([
            'success' => true,
            'message' => 'La respuesta fue enviada.',
            'admin_message' => $this->serializeMessage($message),
        ]);
    }
}
