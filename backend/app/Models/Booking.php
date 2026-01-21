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
        'estado',
        'piojologist_id'
    ];

    protected $casts = [
        'fecha' => 'date',
        'hasAlergias' => 'boolean',
        'numPersonas' => 'integer',
        'piojologist_id' => 'integer'
    ];
}
