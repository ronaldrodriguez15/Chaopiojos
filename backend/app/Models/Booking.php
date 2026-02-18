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
        'services_per_person',
        'whatsapp',
        'email',
        'direccion',
        'barrio',
        'descripcion_ubicacion',
        'lat',
        'lng',
        'numPersonas',
        'edad',
        'hasAlergias',
        'detalleAlergias',
        'referidoPor',
        'referral_code',
        'referred_by_user_id',
        'payment_method',
        'estado',
        'piojologist_id',
        'plan_type',
        'price_confirmed',
        'service_notes',
        'rejection_history',
        'additional_costs',
        'payment_status_to_piojologist'
    ];

    protected $casts = [
        'fecha' => 'date',
        'hasAlergias' => 'boolean',
        'numPersonas' => 'integer',
        'piojologist_id' => 'integer',
        'referred_by_user_id' => 'integer',
        'price_confirmed' => 'decimal:2',
        'additional_costs' => 'decimal:2',
        'lat' => 'decimal:7',
        'lng' => 'decimal:7',
        'rejection_history' => 'array',
        'services_per_person' => 'array'
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array
     */
    protected $appends = [];

    /**
     * Relación con el usuario que refirió (piojóloga)
     */
    public function referredBy()
    {
        return $this->belongsTo(User::class, 'referred_by_user_id');
    }
}
