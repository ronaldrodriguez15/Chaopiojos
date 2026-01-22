<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    use HasFactory;

    protected $fillable = [
        'fecha',
        'hora',
        'clientName',
        'serviceType',
        'whatsapp',
        'email',
        'direccion',
        'barrio',
        'numPersonas',
        'hasAlergias',
        'detalleAlergias',
        'referidoPor',
        'payment_method',
        'estado',
        'piojologist_id',
        'plan_type',
        'price_confirmed',
        'service_notes',
        'rejection_history'
    ];

    protected $casts = [
        'fecha' => 'date',
        'hasAlergias' => 'boolean',
        'numPersonas' => 'integer',
        'piojologist_id' => 'integer',
        'price_confirmed' => 'decimal:2',
        'rejection_history' => 'array'
    ];
}
