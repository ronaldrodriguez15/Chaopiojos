<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReferralCommission extends Model
{
    use HasFactory;

    protected $fillable = [
        'referrer_id',
        'referred_id',
        'booking_id',
        'service_amount',
        'commission_amount',
        'status',
    ];

    protected $casts = [
        'service_amount' => 'decimal:2',
        'commission_amount' => 'decimal:2',
    ];

    /**
     * Piojóloga que hizo el referido
     */
    public function referrer()
    {
        return $this->belongsTo(User::class, 'referrer_id');
    }

    /**
     * Piojóloga que fue referida
     */
    public function referred()
    {
        return $this->belongsTo(User::class, 'referred_id');
    }

    /**
     * Reserva que generó la comisión
     */
    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
