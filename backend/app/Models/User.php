<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'specialty',
        'available',
        'earnings',
        'address',
        'lat',
        'lng',
        'commission_rate',
        'referral_code',
        'referred_by_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
    ];

    /**
     * Generar código de referido único al crear el usuario
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($user) {
            if ($user->role === 'piojologist' && empty($user->referral_code)) {
                $user->referral_code = self::generateUniqueReferralCode();
            }
        });
    }

    /**
     * Genera un código de referido único
     */
    public static function generateUniqueReferralCode()
    {
        do {
            $code = 'PIOJO' . strtoupper(Str::random(6));
        } while (self::where('referral_code', $code)->exists());

        return $code;
    }

    /**
     * Piojóloga que refirió a este usuario
     */
    public function referredBy()
    {
        return $this->belongsTo(User::class, 'referred_by_id');
    }

    /**
     * Piojólogas que este usuario ha referido
     */
    public function referrals()
    {
        return $this->hasMany(User::class, 'referred_by_id');
    }

    /**
     * Comisiones que ha ganado por referir a otras piojólogas
     */
    public function commissionsEarned()
    {
        return $this->hasMany(ReferralCommission::class, 'referrer_id');
    }

    /**
     * Comisiones generadas por ser referida
     */
    public function commissionsGenerated()
    {
        return $this->hasMany(ReferralCommission::class, 'referred_id');
    }
}
