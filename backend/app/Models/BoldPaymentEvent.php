<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BoldPaymentEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'notification_id',
        'booking_id',
        'event_type',
        'payment_status',
        'payment_link',
        'payment_id',
        'payment_method',
        'currency',
        'amount_total',
        'paid_at',
        'occurred_at',
        'payload',
    ];

    protected $casts = [
        'amount_total' => 'decimal:2',
        'paid_at' => 'datetime',
        'occurred_at' => 'datetime',
        'payload' => 'array',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
