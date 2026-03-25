<?php

namespace App\Http\Controllers;

use App\Models\ReferralCommission;
use App\Models\SellerReferral;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SellerReferralController extends Controller
{
    protected function canManage(Request $request): bool
    {
        $role = $request->user()?->role;
        return in_array($role, ['admin', 'vendedor'], true);
    }

    protected function serializeReferral(SellerReferral $referral): array
    {
        return [
            'id' => $referral->id,
            'seller_user_id' => $referral->seller_user_id,
            'reviewed_by_user_id' => $referral->reviewed_by_user_id,
            'business_name' => $referral->business_name,
            'owner_name' => $referral->owner_name,
            'contact_name' => $referral->contact_name,
            'phone' => $referral->phone,
            'whatsapp' => $referral->whatsapp,
            'email' => $referral->email,
            'nit' => $referral->nit,
            'city' => $referral->city,
            'address' => $referral->address,
            'notes' => $referral->notes,
            'status' => $referral->status,
            'link_token' => $referral->link_token,
            'booking_link' => $referral->status === 'approved' && $referral->link_token
                ? '/agenda?sr=' . urlencode($referral->link_token)
                : null,
            'review_notes' => $referral->review_notes,
            'reviewed_at' => $referral->reviewed_at,
            'chamber_of_commerce_path' => $referral->chamber_of_commerce_path,
            'rut_path' => $referral->rut_path,
            'chamber_of_commerce_url' => $referral->chamber_of_commerce_path ? asset('storage/' . $referral->chamber_of_commerce_path) : null,
            'rut_url' => $referral->rut_path ? asset('storage/' . $referral->rut_path) : null,
            'created_at' => $referral->created_at,
            'updated_at' => $referral->updated_at,
            'seller' => $referral->relationLoaded('seller') && $referral->seller
                ? [
                    'id' => $referral->seller->id,
                    'name' => $referral->seller->name,
                    'email' => $referral->seller->email,
                    'referral_code' => $referral->seller->referral_code,
                ]
                : null,
            'reviewer' => $referral->relationLoaded('reviewer') && $referral->reviewer
                ? [
                    'id' => $referral->reviewer->id,
                    'name' => $referral->reviewer->name,
                    'email' => $referral->reviewer->email,
                ]
                : null,
        ];
    }

    protected function ensureSellerReferralCode(SellerReferral $referral): void
    {
        $seller = $referral->seller;
        if (!$seller || $seller->role !== 'vendedor' || !empty($seller->referral_code)) {
            return;
        }

        $seller->referral_code = User::generateUniqueReferralCode('vendedor');
        $seller->save();
    }

    protected function storeDocument(?\Illuminate\Http\UploadedFile $file, string $prefix): ?string
    {
        if (!$file) return null;
        $safePrefix = preg_replace('/[^a-z0-9_-]+/i', '-', strtolower($prefix));
        $extension = $file->getClientOriginalExtension() ?: 'bin';
        $filename = 'seller-referrals/' . $safePrefix . '-' . uniqid() . '.' . $extension;
        Storage::disk('public')->putFileAs('seller-referrals', $file, basename($filename));
        return $filename;
    }

    public function resolveLink(string $token)
    {
        try {
            $referral = SellerReferral::with('seller:id,name,email,role,referral_code')
                ->where('link_token', $token)
                ->where('status', 'approved')
                ->first();

            if (!$referral || !$referral->seller || $referral->seller->role !== 'vendedor') {
                return response()->json([
                    'success' => false,
                    'message' => 'El link de peluqueria no es valido o no esta aprobado'
                ], 404);
            }

            $this->ensureSellerReferralCode($referral);
            $referral->refresh()->load('seller:id,name,email,role,referral_code');

            return response()->json([
                'success' => true,
                'referral' => $this->serializeReferral($referral),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al resolver el link de peluqueria: ' . $e->getMessage()
            ], 500);
        }
    }

    public function index(Request $request)
    {
        try {
            if (!$this->canManage($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado para consultar referidos de vendedor'
                ], 403);
            }

            $user = $request->user();
            $query = SellerReferral::with(['seller:id,name,email', 'reviewer:id,name,email'])->orderBy('created_at', 'desc');

            if ($user->role === 'vendedor') {
                $query->where('seller_user_id', $user->id);
            }

            $referrals = $query->get()->map(fn ($item) => $this->serializeReferral($item))->values();

            return response()->json([
                'success' => true,
                'referrals' => $referrals,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener referidos del vendedor: ' . $e->getMessage()
            ], 500);
        }
    }

    public function statistics(Request $request)
    {
        try {
            if (!$this->canManage($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado para consultar estadísticas'
                ], 403);
            }

            $user = $request->user();
            $query = SellerReferral::query();

            if ($user->role === 'vendedor') {
                $query->where('seller_user_id', $user->id);
            }

            $all = $query->get();
            $now = now();
            $pending = $all->where('status', 'pending_review')->count();
            $approved = $all->where('status', 'approved')->count();
            $rejected = $all->where('status', 'rejected')->count();
            $withDocs = $all->filter(fn ($item) => !empty($item->chamber_of_commerce_path) && !empty($item->rut_path))->count();
            $thisMonth = $all->filter(fn ($item) => $item->created_at && $item->created_at->month === $now->month && $item->created_at->year === $now->year)->count();

            return response()->json([
                'success' => true,
                'statistics' => [
                    'total' => $all->count(),
                    'pending_review' => $pending,
                    'approved' => $approved,
                    'rejected' => $rejected,
                    'with_documents' => $withDocs,
                    'this_month' => $thisMonth,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas del vendedor: ' . $e->getMessage()
            ], 500);
        }
    }

    public function earnings(Request $request)
    {
        try {
            if (!$this->canManage($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado para consultar ganancias'
                ], 403);
            }

            $authUser = $request->user();
            $sellerIds = $authUser->role === 'vendedor'
                ? [$authUser->id]
                : User::where('role', 'vendedor')->pluck('id')->all();

            $sellers = User::whereIn('id', $sellerIds)
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'referral_code']);

            $items = $sellers->map(function (User $seller) {
                $commissions = ReferralCommission::where('referrer_id', $seller->id)
                    ->with('booking:id,clientName,fecha,hora,numPersonas,seller_referral_id')
                    ->with('booking.sellerReferral:id,business_name')
                    ->orderBy('created_at', 'desc')
                    ->get();

                $pendingAmount = (float) $commissions->where('status', 'pending')->sum('commission_amount');
                $paidAmount = (float) $commissions->where('status', 'paid')->sum('commission_amount');
                $headsCount = (int) $commissions->reduce(function ($carry, $commission) {
                    return $carry + max(1, (int) ($commission->booking->numPersonas ?? 1));
                }, 0);
                $approvedReferrals = SellerReferral::where('seller_user_id', $seller->id)
                    ->where('status', 'approved')
                    ->count();

                return [
                    'seller' => [
                        'id' => $seller->id,
                        'name' => $seller->name,
                        'email' => $seller->email,
                        'referral_code' => $seller->referral_code,
                    ],
                    'summary' => [
                        'pending_amount' => $pendingAmount,
                        'paid_amount' => $paidAmount,
                        'total_amount' => $pendingAmount + $paidAmount,
                        'bookings_count' => $commissions->count(),
                        'heads_count' => $headsCount,
                        'approved_referrals' => $approvedReferrals,
                    ],
                    'commissions' => $commissions->map(function ($commission) {
                        return [
                            'id' => $commission->id,
                            'booking_id' => $commission->booking_id,
                            'commission_amount' => (float) $commission->commission_amount,
                            'service_amount' => (float) $commission->service_amount,
                            'status' => $commission->status,
                            'created_at' => $commission->created_at,
                            'booking' => $commission->booking ? [
                                'id' => $commission->booking->id,
                                'clientName' => $commission->booking->clientName,
                                'fecha' => $commission->booking->fecha,
                                'hora' => $commission->booking->hora,
                                'numPersonas' => $commission->booking->numPersonas,
                                'seller_referral_name' => $commission->booking->sellerReferral?->business_name,
                            ] : null,
                        ];
                    })->values(),
                ];
            })->values();

            return response()->json([
                'success' => true,
                'earnings' => $authUser->role === 'vendedor' ? ($items->first() ?? null) : null,
                'sellers' => $authUser->role === 'admin' ? $items : [],
                'summary' => [
                    'pending_amount' => (float) $items->sum(fn ($item) => $item['summary']['pending_amount'] ?? 0),
                    'paid_amount' => (float) $items->sum(fn ($item) => $item['summary']['paid_amount'] ?? 0),
                    'total_amount' => (float) $items->sum(fn ($item) => $item['summary']['total_amount'] ?? 0),
                    'bookings_count' => (int) $items->sum(fn ($item) => $item['summary']['bookings_count'] ?? 0),
                    'heads_count' => (int) $items->sum(fn ($item) => $item['summary']['heads_count'] ?? 0),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener ganancias del vendedor: ' . $e->getMessage()
            ], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            if ($request->user()?->role !== 'vendedor') {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo los vendedores pueden registrar contratos'
                ], 403);
            }

            $validated = $request->validate([
                'business_name' => 'required|string|max:255',
                'owner_name' => 'nullable|string|max:255',
                'contact_name' => 'required|string|max:255',
                'phone' => 'nullable|string|max:30',
                'whatsapp' => 'nullable|string|max:30',
                'email' => 'nullable|email|max:255',
                'nit' => 'nullable|string|max:50',
                'city' => 'nullable|string|max:120',
                'address' => 'nullable|string|max:255',
                'notes' => 'nullable|string|max:5000',
                'chamber_of_commerce' => 'nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:5120',
                'rut' => 'nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:5120',
            ]);

            $referral = SellerReferral::create([
                'seller_user_id' => $request->user()->id,
                'business_name' => $validated['business_name'],
                'owner_name' => $validated['owner_name'] ?? null,
                'contact_name' => $validated['contact_name'],
                'phone' => $validated['phone'] ?? null,
                'whatsapp' => $validated['whatsapp'] ?? null,
                'email' => $validated['email'] ?? null,
                'nit' => $validated['nit'] ?? null,
                'city' => $validated['city'] ?? null,
                'address' => $validated['address'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'status' => 'pending_review',
                'chamber_of_commerce_path' => $this->storeDocument($request->file('chamber_of_commerce'), 'camara-comercio'),
                'rut_path' => $this->storeDocument($request->file('rut'), 'rut'),
            ]);

            $referral->load('seller:id,name,email');

            return response()->json([
                'success' => true,
                'message' => 'Contrato referido registrado exitosamente',
                'referral' => $this->serializeReferral($referral),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar referido del vendedor: ' . $e->getMessage()
            ], 500);
        }
    }

    public function review(Request $request, $id)
    {
        try {
            if ($request->user()?->role !== 'admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo un administrador puede revisar referidos'
                ], 403);
            }

            $validated = $request->validate([
                'status' => 'required|string|in:approved,rejected',
                'review_notes' => 'nullable|string|max:5000',
            ]);

            $referral = SellerReferral::findOrFail($id);
            $referral->status = $validated['status'];
            $referral->review_notes = $validated['review_notes'] ?? null;
            $referral->reviewed_at = now();
            $referral->reviewed_by_user_id = $request->user()->id;
            $referral->save();
            $referral->load(['seller:id,name,email', 'reviewer:id,name,email']);

            if ($validated['status'] === 'approved') {
                $this->ensureSellerReferralCode($referral);
                $referral->refresh()->load(['seller:id,name,email,referral_code', 'reviewer:id,name,email']);
            }

            return response()->json([
                'success' => true,
                'message' => $validated['status'] === 'approved'
                    ? 'Referido aprobado exitosamente'
                    : 'Referido rechazado exitosamente',
                'referral' => $this->serializeReferral($referral),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Referido no encontrado'
            ], 404);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al revisar referido: ' . $e->getMessage()
            ], 500);
        }
    }
}
