<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SellerReferralMonthlyHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'seller_referral_id',
        'period_start',
        'period_end',
        'bookings_count',
        'completed_bookings',
        'pending_bookings',
        'pending_amount',
        'completed_amount',
        'total_amount',
        'tier_snapshot',
        'is_closed',
        'closed_at',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'pending_amount' => 'decimal:2',
        'completed_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'tier_snapshot' => 'array',
        'is_closed' => 'boolean',
        'closed_at' => 'datetime',
    ];

    public function sellerReferral()
    {
        return $this->belongsTo(SellerReferral::class, 'seller_referral_id');
    }
}
