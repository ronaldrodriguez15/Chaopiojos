<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\AppSetting;
use App\Models\ReferralCommission;
use App\Models\SellerReferral;
use App\Models\SellerReferralMonthlyHistory;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SellerReferralController extends Controller
{
    protected function getDefaultSellerReferralValue(): float
    {
        return (float) AppSetting::getValue('seller_referral_value', '5000');
    }

    protected function canAccessReferrals(Request $request): bool
    {
        $role = $request->user()?->role;
        return in_array($role, ['admin', 'vendedor', 'referido'], true);
    }

    protected function canAccessSellerReports(Request $request): bool
    {
        $role = $request->user()?->role;
        return in_array($role, ['admin', 'vendedor'], true);
    }

    protected function scopeReferralsForUser(Builder $query, User $user): Builder
    {
        if ($user->role === 'vendedor') {
            $query->where('seller_user_id', $user->id);
        }

        if ($user->role === 'referido') {
            $query->where('referred_user_id', $user->id);
        }

        return $query;
    }

    protected function serializeReferral(SellerReferral $referral): array
    {
        $hasActiveBookingLink = !empty($referral->link_token) && $referral->status !== 'rejected';

        return [
            'id' => $referral->id,
            'seller_user_id' => $referral->seller_user_id,
            'referred_user_id' => $referral->referred_user_id,
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
            'booking_link' => $hasActiveBookingLink ? '/agenda?sr=' . urlencode($referral->link_token) : null,
            'review_notes' => $referral->review_notes,
            'reviewed_at' => $referral->reviewed_at,
            'chamber_of_commerce_path' => $referral->chamber_of_commerce_path,
            'rut_path' => $referral->rut_path,
            'place_photo_path' => $referral->place_photo_path,
            'logo_path' => $referral->logo_path,
            'citizenship_card_path' => $referral->citizenship_card_path,
            'chamber_of_commerce_url' => $referral->chamber_of_commerce_path ? asset('storage/' . $referral->chamber_of_commerce_path) : null,
            'rut_url' => $referral->rut_path ? asset('storage/' . $referral->rut_path) : null,
            'place_photo_url' => $referral->place_photo_path ? asset('storage/' . $referral->place_photo_path) : null,
            'logo_url' => $referral->logo_path ? asset('storage/' . $referral->logo_path) : null,
            'citizenship_card_url' => $referral->citizenship_card_path ? asset('storage/' . $referral->citizenship_card_path) : null,
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
            'referred_user' => $referral->relationLoaded('referredUser') && $referral->referredUser
                ? [
                    'id' => $referral->referredUser->id,
                    'name' => $referral->referredUser->name,
                    'email' => $referral->referredUser->email,
                    'is_active' => (bool) $referral->referredUser->is_active,
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
        if (!$file) {
            return null;
        }

        $safePrefix = preg_replace('/[^a-z0-9_-]+/i', '-', strtolower($prefix));
        $extension = $file->getClientOriginalExtension() ?: 'bin';
        $filename = 'seller-referrals/' . $safePrefix . '-' . uniqid() . '.' . $extension;
        Storage::disk('public')->putFileAs('seller-referrals', $file, basename($filename));

        return $filename;
    }

    protected function deleteStoredDocument(?string $path): void
    {
        if (!$path) {
            return;
        }

        Storage::disk('public')->delete($path);
    }

    protected function replaceStoredDocument(Request $request, SellerReferral $referral, string $inputName, string $attribute, string $prefix): ?string
    {
        if (!$request->hasFile($inputName)) {
            return $referral->{$attribute};
        }

        $newPath = $this->storeDocument($request->file($inputName), $prefix);
        $this->deleteStoredDocument($referral->{$attribute});

        return $newPath;
    }

    protected function getDefaultPartnerCommissionTiers(): array
    {
        return [
            ['from' => 1, 'to' => 20, 'value' => 5000],
            ['from' => 21, 'to' => 40, 'value' => 7000],
            ['from' => 41, 'to' => null, 'value' => 100000],
        ];
    }

    protected function normalizePartnerCommissionTiers($tiers): array
    {
        if (is_string($tiers) && trim($tiers) !== '') {
            $decoded = json_decode($tiers, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $tiers = $decoded;
            }
        }

        if (!is_array($tiers)) {
            return $this->getDefaultPartnerCommissionTiers();
        }

        $normalized = collect($tiers)
            ->map(function ($tier) {
                if (!is_array($tier)) {
                    return null;
                }

                $from = (int) ($tier['from'] ?? 0);
                $to = array_key_exists('to', $tier) && $tier['to'] !== null && $tier['to'] !== ''
                    ? (int) $tier['to']
                    : null;
                $value = (float) ($tier['value'] ?? 0);

                if ($from < 1 || $value < 0) {
                    return null;
                }

                if ($to !== null && $to < $from) {
                    return null;
                }

                return [
                    'from' => $from,
                    'to' => $to,
                    'value' => $value,
                ];
            })
            ->filter()
            ->sortBy('from')
            ->values()
            ->all();

        return !empty($normalized) ? $normalized : $this->getDefaultPartnerCommissionTiers();
    }

    protected function getPartnerCommissionTiers(): array
    {
        return $this->normalizePartnerCommissionTiers(
            AppSetting::getValue(
                'partner_commission_tiers',
                json_encode($this->getDefaultPartnerCommissionTiers())
            )
        );
    }

    protected function resolvePartnerCommissionTier(int $position, array $tiers): array
    {
        foreach ($tiers as $tier) {
            $from = (int) ($tier['from'] ?? 1);
            $to = array_key_exists('to', $tier) && $tier['to'] !== null ? (int) $tier['to'] : null;
            if ($position >= $from && ($to === null || $position <= $to)) {
                return [
                    'from' => $from,
                    'to' => $to,
                    'value' => (float) ($tier['value'] ?? 0),
                ];
            }
        }

        $lastTier = collect($tiers)->last() ?: ['from' => 1, 'to' => null, 'value' => 0];

        return [
            'from' => (int) ($lastTier['from'] ?? 1),
            'to' => array_key_exists('to', $lastTier) && $lastTier['to'] !== null ? (int) $lastTier['to'] : null,
            'value' => (float) ($lastTier['value'] ?? 0),
        ];
    }

    protected function buildPartnerCommissionRows(Collection $bookings, array $tiers): Collection
    {
        $sortedBookings = $bookings
            ->sort(function (Booking $a, Booking $b) {
                $aDate = $a->created_at ? $a->created_at->timestamp : ($a->fecha ? Carbon::parse($a->fecha)->timestamp : 0);
                $bDate = $b->created_at ? $b->created_at->timestamp : ($b->fecha ? Carbon::parse($b->fecha)->timestamp : 0);

                if ($aDate === $bDate) {
                    return $a->id <=> $b->id;
                }

                return $aDate <=> $bDate;
            })
            ->values();

        $completedStatuses = ['completed', 'completado'];
        $monthlyPositions = [];

        return $sortedBookings->map(function (Booking $booking) use ($tiers, $completedStatuses, &$monthlyPositions) {
            $baseDate = $booking->created_at
                ? $booking->created_at->copy()
                : ($booking->fecha ? Carbon::parse($booking->fecha) : now());
            $periodStart = $baseDate->copy()->startOfMonth();
            $monthKey = $periodStart->toDateString();
            $monthlyPositions[$monthKey] = ($monthlyPositions[$monthKey] ?? 0) + 1;
            $position = $monthlyPositions[$monthKey];
            $tier = $this->resolvePartnerCommissionTier($position, $tiers);
            $isCompleted = in_array(strtolower((string) $booking->estado), $completedStatuses, true);

            return [
                'booking' => $booking,
                'position' => $position,
                'period_start' => $monthKey,
                'period_end' => $periodStart->copy()->endOfMonth()->toDateString(),
                'amount' => (float) $tier['value'],
                'is_completed' => $isCompleted,
                'tier' => $tier,
            ];
        });
    }

    protected function syncPartnerMonthlyHistory(SellerReferral $referral, Collection $commissionRows, array $tiers): Collection
    {
        $currentMonthStart = now()->startOfMonth()->toDateString();
        $existingRows = SellerReferralMonthlyHistory::where('seller_referral_id', $referral->id)
            ->get()
            ->keyBy(fn (SellerReferralMonthlyHistory $row) => $row->period_start->toDateString());

        $groupedByMonth = $commissionRows->groupBy('period_start');

        foreach ($groupedByMonth as $periodStart => $rows) {
            $existingRow = $existingRows->get($periodStart);
            if ($existingRow && $existingRow->is_closed) {
                continue;
            }

            $periodStartDate = Carbon::parse($periodStart)->startOfMonth();
            $isClosed = $periodStartDate->toDateString() < $currentMonthStart;
            $bookingsCount = (int) $rows->count();
            $completedBookings = (int) $rows->where('is_completed', true)->count();
            $pendingBookings = max(0, $bookingsCount - $completedBookings);
            $totalAmount = (float) $rows->sum('amount');
            $completedAmount = (float) $rows->where('is_completed', true)->sum('amount');
            $pendingAmount = (float) max(0, $totalAmount - $completedAmount);

            SellerReferralMonthlyHistory::updateOrCreate(
                [
                    'seller_referral_id' => $referral->id,
                    'period_start' => $periodStartDate->toDateString(),
                ],
                [
                    'period_end' => $periodStartDate->copy()->endOfMonth()->toDateString(),
                    'bookings_count' => $bookingsCount,
                    'completed_bookings' => $completedBookings,
                    'pending_bookings' => $pendingBookings,
                    'pending_amount' => $pendingAmount,
                    'completed_amount' => $completedAmount,
                    'total_amount' => $totalAmount,
                    'tier_snapshot' => $tiers,
                    'is_closed' => $isClosed,
                    'closed_at' => $isClosed ? $periodStartDate->copy()->endOfMonth()->endOfDay() : null,
                ]
            );
        }

        return SellerReferralMonthlyHistory::where('seller_referral_id', $referral->id)
            ->orderByDesc('period_start')
            ->get();
    }

    protected function serializePartnerMonthlyHistory(SellerReferralMonthlyHistory $row): array
    {
        return [
            'id' => $row->id,
            'period_start' => $row->period_start?->toDateString(),
            'period_end' => $row->period_end?->toDateString(),
            'bookings_count' => (int) ($row->bookings_count ?? 0),
            'completed_bookings' => (int) ($row->completed_bookings ?? 0),
            'pending_bookings' => (int) ($row->pending_bookings ?? 0),
            'pending_amount' => (float) ($row->pending_amount ?? 0),
            'completed_amount' => (float) ($row->completed_amount ?? 0),
            'total_amount' => (float) ($row->total_amount ?? 0),
            'tier_snapshot' => $this->normalizePartnerCommissionTiers($row->tier_snapshot),
            'is_closed' => (bool) $row->is_closed,
            'closed_at' => $row->closed_at,
        ];
    }

    protected function buildPartnerDashboard(SellerReferral $referral): array
    {
        $bookings = Booking::where('seller_referral_id', $referral->id)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get([
                'id',
                'clientName',
                'fecha',
                'hora',
                'serviceType',
                'services_per_person',
                'numPersonas',
                'estado',
                'price_confirmed',
                'additional_costs',
                'created_at',
            ]);

        $now = now();
        $tiers = $this->getPartnerCommissionTiers();
        $commissionRows = $this->buildPartnerCommissionRows($bookings, $tiers);
        $monthlyHistory = $this->syncPartnerMonthlyHistory($referral, $commissionRows, $tiers);
        $latestHistory = $monthlyHistory->sortByDesc('period_start')->values();
        $currentMonthRow = $latestHistory->first(function (SellerReferralMonthlyHistory $row) use ($now) {
            return $row->period_start
                && $row->period_start->month === $now->month
                && $row->period_start->year === $now->year;
        });
        $registeredClients = $bookings->count();
        $headsCount = (int) $bookings->reduce(function ($carry, Booking $booking) {
            return $carry + max(1, (int) ($booking->numPersonas ?? 1));
        }, 0);
        $completedBookings = (int) $latestHistory->sum('completed_bookings');
        $thisMonth = $bookings->filter(function (Booking $booking) use ($now) {
            return $booking->created_at
                && $booking->created_at->month === $now->month
                && $booking->created_at->year === $now->year;
        })->count();
        $totalAmount = (float) $latestHistory->sum('total_amount');
        $completedAmount = (float) $latestHistory->sum('completed_amount');
        $pendingAmount = (float) $latestHistory->sum('pending_amount');
        $thisMonthAmount = (float) ($currentMonthRow?->total_amount ?? 0);
        $currentMonthCompleted = (int) ($currentMonthRow?->completed_bookings ?? 0);
        $currentMonthPending = (int) ($currentMonthRow?->pending_bookings ?? 0);
        $recentRows = $commissionRows
            ->sortByDesc(fn (array $item) => optional($item['booking']->created_at)->timestamp ?? 0)
            ->take(10)
            ->values();

        return [
            'statistics' => [
                'registered_clients' => $registeredClients,
                'heads_count' => $headsCount,
                'completed_bookings' => $completedBookings,
                'pending_bookings' => max(0, $registeredClients - $completedBookings),
                'this_month' => $thisMonth,
                'this_month_amount' => $thisMonthAmount,
            ],
            'earnings' => [
                'summary' => [
                    'pending_amount' => $pendingAmount,
                    'completed_amount' => $completedAmount,
                    'total_amount' => $totalAmount,
                    'bookings_count' => $registeredClients,
                    'heads_count' => $headsCount,
                    'completed_bookings' => $completedBookings,
                    'pending_bookings' => max(0, $registeredClients - $completedBookings),
                    'this_month_amount' => $thisMonthAmount,
                    'current_month_completed_bookings' => $currentMonthCompleted,
                    'current_month_pending_bookings' => $currentMonthPending,
                    'commission_tiers' => $tiers,
                ],
            ],
            'recent_bookings' => $recentRows->map(function (array $item) {
                $booking = $item['booking'];
                return [
                    'id' => $booking->id,
                    'clientName' => $booking->clientName,
                    'fecha' => $booking->fecha,
                    'hora' => $booking->hora,
                    'serviceType' => $booking->serviceType,
                    'numPersonas' => (int) ($booking->numPersonas ?? 1),
                    'estado' => $booking->estado,
                    'total_amount' => (float) $item['amount'],
                    'is_completed' => (bool) $item['is_completed'],
                    'monthly_position' => (int) ($item['position'] ?? 0),
                    'tier_value' => (float) ($item['tier']['value'] ?? 0),
                    'created_at' => $booking->created_at,
                ];
            })->values(),
            'monthly_history' => $latestHistory
                ->take(12)
                ->map(fn (SellerReferralMonthlyHistory $row) => $this->serializePartnerMonthlyHistory($row))
                ->values(),
        ];
    }

    public function resolveLink(string $token)
    {
        try {
            $referral = SellerReferral::with([
                'seller:id,name,email,role,referral_code',
                'referredUser:id,name,email,is_active',
            ])
                ->where('link_token', $token)
                ->whereIn('status', ['pending_review', 'approved'])
                ->first();

            if (!$referral) {
                return response()->json([
                    'success' => false,
                    'message' => 'El enlace del establecimiento no es válido o fue desactivado'
                ], 404);
            }

            if ($referral->seller && $referral->seller->role === 'vendedor') {
                $this->ensureSellerReferralCode($referral);
            }
            $referral->refresh()->load([
                'seller:id,name,email,role,referral_code',
                'referredUser:id,name,email,is_active',
            ]);

            return response()->json([
                'success' => true,
                'referral' => $this->serializeReferral($referral),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al resolver el enlace del establecimiento: ' . $e->getMessage()
            ], 500);
        }
    }

    public function index(Request $request)
    {
        try {
            if (!$this->canAccessReferrals($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado para consultar referidos de vendedor'
                ], 403);
            }

            $user = $request->user();
            $query = SellerReferral::with([
                'seller:id,name,email,referral_code',
                'referredUser:id,name,email,is_active',
                'reviewer:id,name,email',
            ])->orderBy('created_at', 'desc');

            $this->scopeReferralsForUser($query, $user);

            $referrals = $query->get()->map(fn (SellerReferral $item) => $this->serializeReferral($item))->values();

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
            if (!$this->canAccessSellerReports($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado para consultar estadÃ­sticas'
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
            $withDocs = $all->filter(fn (SellerReferral $item) => !empty($item->chamber_of_commerce_path) && !empty($item->rut_path))->count();
            $thisMonth = $all->filter(fn (SellerReferral $item) => $item->created_at && $item->created_at->month === $now->month && $item->created_at->year === $now->year)->count();

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
                'message' => 'Error al obtener estadÃ­sticas del vendedor: ' . $e->getMessage()
            ], 500);
        }
    }

    public function earnings(Request $request)
    {
        try {
            if (!$this->canAccessSellerReports($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado para consultar ganancias'
                ], 403);
            }

            $authUser = $request->user();
            $sellerIds = $authUser->role === 'vendedor'
                ? [$authUser->id]
                : User::where('role', 'vendedor')->pluck('id')->all();

            $defaultSellerReferralValue = $this->getDefaultSellerReferralValue();
            $sellers = User::whereIn('id', $sellerIds)
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'referral_code', 'referral_value']);

            $items = $sellers->map(function (User $seller) use ($defaultSellerReferralValue) {
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
                $effectiveReferralValue = (float) ($seller->referral_value ?? $defaultSellerReferralValue);

                return [
                    'seller' => [
                        'id' => $seller->id,
                        'name' => $seller->name,
                        'email' => $seller->email,
                        'referral_code' => $seller->referral_code,
                        'referral_value' => $seller->referral_value !== null ? (float) $seller->referral_value : null,
                        'effective_referral_value' => $effectiveReferralValue,
                    ],
                    'summary' => [
                        'pending_amount' => $pendingAmount,
                        'paid_amount' => $paidAmount,
                        'total_amount' => $pendingAmount + $paidAmount,
                        'bookings_count' => $commissions->count(),
                        'heads_count' => $headsCount,
                        'approved_referrals' => $approvedReferrals,
                        'per_head_value' => $effectiveReferralValue,
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
                    'default_per_head_value' => $defaultSellerReferralValue,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener ganancias del vendedor: ' . $e->getMessage()
            ], 500);
        }
    }

    public function partnerDashboard(Request $request)
    {
        try {
            if ($request->user()?->role !== 'referido') {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo un establecimiento puede consultar este panel'
                ], 403);
            }

            $referral = SellerReferral::with([
                'seller:id,name,email,referral_code',
                'referredUser:id,name,email,is_active',
            ])
                ->where('referred_user_id', $request->user()->id)
                ->first();

            if (!$referral) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontró el establecimiento asociado a este usuario'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'referral' => $this->serializeReferral($referral),
                ...$this->buildPartnerDashboard($referral),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cargar el panel del establecimiento: ' . $e->getMessage()
            ], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $authUser = $request->user();
            $isAdmin = $authUser?->role === 'admin';
            $isSeller = $authUser?->role === 'vendedor';

            if (!$isAdmin && !$isSeller) {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo administradores o vendedores pueden registrar establecimientos'
                ], 403);
            }

            $validated = $request->validate([
                'business_name' => 'required|string|max:255',
                'owner_name' => 'nullable|string|max:255',
                'contact_name' => 'nullable|string|max:255',
                'phone' => 'nullable|string|max:30',
                'whatsapp' => 'nullable|string|max:30',
                'email' => 'required|email|max:255|unique:users,email',
                'password' => 'required|string|min:6|max:255',
                'nit' => 'nullable|string|max:50',
                'city' => 'nullable|string|max:120',
                'address' => 'nullable|string|max:255',
                'notes' => 'nullable|string|max:5000',
                'chamber_of_commerce' => 'nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:5120',
                'rut' => 'nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:5120',
                'place_photo' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
                'logo' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
                'citizenship_card' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
            ]);

            $resolvedContactName = trim((string) ($validated['contact_name'] ?? ''));
            if ($resolvedContactName === '') {
                $resolvedContactName = trim((string) ($validated['owner_name'] ?? '')) ?: $validated['business_name'];
            }

            $referredUser = null;
            $referral = DB::transaction(function () use ($request, $validated, $resolvedContactName, $authUser, $isAdmin, &$referredUser) {
                $referredUser = User::create([
                    'name' => $validated['business_name'],
                    'email' => $validated['email'],
                    'password' => Hash::make($validated['password']),
                    'role' => 'referido',
                    'available' => false,
                    'is_active' => true,
                    'earnings' => 0,
                    'address' => $validated['address'] ?? null,
                ]);

                return SellerReferral::create([
                    'seller_user_id' => $isAdmin ? null : $authUser->id,
                    'referred_user_id' => $referredUser->id,
                    'business_name' => $validated['business_name'],
                    'owner_name' => $validated['owner_name'] ?? null,
                    'contact_name' => $resolvedContactName,
                    'phone' => $validated['phone'] ?? null,
                    'whatsapp' => $validated['whatsapp'] ?? null,
                    'email' => $validated['email'],
                    'nit' => $validated['nit'] ?? null,
                    'city' => $validated['city'] ?? null,
                    'address' => $validated['address'] ?? null,
                    'notes' => $validated['notes'] ?? null,
                    'status' => $isAdmin ? 'approved' : 'pending_review',
                    'reviewed_by_user_id' => $isAdmin ? $authUser?->id : null,
                    'reviewed_at' => $isAdmin ? now() : null,
                    'chamber_of_commerce_path' => $this->storeDocument($request->file('chamber_of_commerce'), 'camara-comercio'),
                    'rut_path' => $this->storeDocument($request->file('rut'), 'rut'),
                    'place_photo_path' => $this->storeDocument($request->file('place_photo'), 'foto-lugar'),
                    'logo_path' => $this->storeDocument($request->file('logo'), 'logo-establecimiento'),
                    'citizenship_card_path' => $this->storeDocument($request->file('citizenship_card'), 'cedula-ciudadania'),
                ]);
            });

            $referral->load([
                'seller:id,name,email,referral_code',
                'referredUser:id,name,email,is_active',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Establecimiento registrado y usuario creado exitosamente',
                'referral' => $this->serializeReferral($referral),
                'credentials' => [
                    'email' => $referredUser?->email,
                ],
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
                'message' => 'Error al registrar establecimiento: ' . $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $authUser = $request->user();
            $isAdmin = $authUser?->role === 'admin';
            $isSeller = $authUser?->role === 'vendedor';

            if (!$isAdmin && !$isSeller) {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo administradores o vendedores pueden editar establecimientos'
                ], 403);
            }

            $query = SellerReferral::with([
                'seller:id,name,email,referral_code,role',
                'referredUser:id,name,email,is_active,address',
                'reviewer:id,name,email',
            ]);

            if ($isSeller) {
                $query->where('seller_user_id', $authUser->id);
            }

            $referral = $query->findOrFail($id);

            $validated = $request->validate([
                'business_name' => 'sometimes|required|string|max:255',
                'owner_name' => 'sometimes|nullable|string|max:255',
                'contact_name' => 'sometimes|nullable|string|max:255',
                'phone' => 'sometimes|nullable|string|max:30',
                'whatsapp' => 'sometimes|nullable|string|max:30',
                'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($referral->referred_user_id)],
                'password' => 'sometimes|nullable|string|min:6|max:255',
                'nit' => 'sometimes|nullable|string|max:50',
                'city' => 'sometimes|nullable|string|max:120',
                'address' => 'sometimes|nullable|string|max:255',
                'notes' => 'sometimes|nullable|string|max:5000',
                'chamber_of_commerce' => 'sometimes|nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:5120',
                'rut' => 'sometimes|nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:5120',
                'place_photo' => 'sometimes|nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
                'logo' => 'sometimes|nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
                'citizenship_card' => 'sometimes|nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
            ]);

            $businessName = array_key_exists('business_name', $validated)
                ? $validated['business_name']
                : $referral->business_name;
            $ownerName = array_key_exists('owner_name', $validated)
                ? ($validated['owner_name'] ?? null)
                : $referral->owner_name;
            $resolvedContactName = array_key_exists('contact_name', $validated)
                ? trim((string) ($validated['contact_name'] ?? ''))
                : trim((string) ($referral->contact_name ?? ''));

            if ($resolvedContactName === '') {
                $resolvedContactName = trim((string) ($ownerName ?? '')) ?: $businessName;
            }

            DB::transaction(function () use ($request, $validated, $referral, $businessName, $ownerName, $resolvedContactName, $isSeller) {
                $referredUser = $referral->referredUser;

                if ($referredUser) {
                    $userUpdates = [];

                    if (array_key_exists('business_name', $validated)) {
                        $userUpdates['name'] = $businessName;
                    }
                    if (array_key_exists('email', $validated)) {
                        $userUpdates['email'] = $validated['email'];
                    }
                    if (array_key_exists('address', $validated)) {
                        $userUpdates['address'] = $validated['address'] ?? null;
                    }
                    if (!empty($validated['password'])) {
                        $userUpdates['password'] = Hash::make($validated['password']);
                    }
                    if ($isSeller) {
                        $userUpdates['is_active'] = true;
                    }

                    if (!empty($userUpdates)) {
                        $referredUser->update($userUpdates);
                    }
                }

                $referral->business_name = $businessName;
                $referral->owner_name = $ownerName;
                $referral->contact_name = $resolvedContactName;

                if (array_key_exists('phone', $validated)) {
                    $referral->phone = $validated['phone'] ?? null;
                }
                if (array_key_exists('whatsapp', $validated)) {
                    $referral->whatsapp = $validated['whatsapp'] ?? null;
                }
                if (array_key_exists('email', $validated)) {
                    $referral->email = $validated['email'];
                }
                if (array_key_exists('nit', $validated)) {
                    $referral->nit = $validated['nit'] ?? null;
                }
                if (array_key_exists('city', $validated)) {
                    $referral->city = $validated['city'] ?? null;
                }
                if (array_key_exists('address', $validated)) {
                    $referral->address = $validated['address'] ?? null;
                }
                if (array_key_exists('notes', $validated)) {
                    $referral->notes = $validated['notes'] ?? null;
                }

                $referral->chamber_of_commerce_path = $this->replaceStoredDocument($request, $referral, 'chamber_of_commerce', 'chamber_of_commerce_path', 'camara-comercio');
                $referral->rut_path = $this->replaceStoredDocument($request, $referral, 'rut', 'rut_path', 'rut');
                $referral->place_photo_path = $this->replaceStoredDocument($request, $referral, 'place_photo', 'place_photo_path', 'foto-lugar');
                $referral->logo_path = $this->replaceStoredDocument($request, $referral, 'logo', 'logo_path', 'logo-establecimiento');
                $referral->citizenship_card_path = $this->replaceStoredDocument($request, $referral, 'citizenship_card', 'citizenship_card_path', 'cedula-ciudadania');

                if ($isSeller) {
                    $referral->status = 'pending_review';
                    $referral->review_notes = null;
                    $referral->reviewed_at = null;
                    $referral->reviewed_by_user_id = null;
                }

                $referral->save();
            });

            if ($referral->seller && $referral->seller->role === 'vendedor') {
                $this->ensureSellerReferralCode($referral);
            }

            $referral->refresh()->load([
                'seller:id,name,email,referral_code,role',
                'referredUser:id,name,email,is_active',
                'reviewer:id,name,email',
            ]);

            return response()->json([
                'success' => true,
                'message' => $isSeller
                    ? 'Establecimiento actualizado y enviado nuevamente a revisión'
                    : 'Establecimiento actualizado exitosamente',
                'referral' => $this->serializeReferral($referral),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Establecimiento no encontrado'
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
                'message' => 'Error al actualizar establecimiento: ' . $e->getMessage()
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

            $referral = SellerReferral::with('referredUser')->findOrFail($id);
            $referral->status = $validated['status'];
            $referral->review_notes = $validated['review_notes'] ?? null;
            $referral->reviewed_at = now();
            $referral->reviewed_by_user_id = $request->user()->id;
            $referral->save();

            if ($referral->referredUser) {
                $referral->referredUser->is_active = $validated['status'] !== 'rejected';
                $referral->referredUser->save();
            }

            $referral->load([
                'seller:id,name,email,referral_code',
                'referredUser:id,name,email,is_active',
                'reviewer:id,name,email',
            ]);

            if ($validated['status'] === 'approved') {
                $this->ensureSellerReferralCode($referral);
                $referral->refresh()->load([
                    'seller:id,name,email,referral_code',
                    'referredUser:id,name,email,is_active',
                    'reviewer:id,name,email',
                ]);
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

