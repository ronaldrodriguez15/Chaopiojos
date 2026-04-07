<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SellerReferral extends Model
{
    use HasFactory;

    protected $fillable = [
        'seller_user_id',
        'referred_user_id',
        'business_name',
        'owner_name',
        'contact_name',
        'phone',
        'whatsapp',
        'email',
        'nit',
        'city',
        'address',
        'notes',
        'status',
        'link_token',
        'reviewed_by_user_id',
        'review_notes',
        'reviewed_at',
        'chamber_of_commerce_path',
        'rut_path',
        'place_photo_path',
        'logo_path',
        'citizenship_card_path',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (SellerReferral $referral) {
            if (empty($referral->link_token)) {
                $referral->link_token = self::generateUniqueLinkToken();
            }
        });
    }

    public static function generateUniqueLinkToken(): string
    {
        do {
            $token = strtolower(Str::random(24));
        } while (self::where('link_token', $token)->exists());

        return $token;
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    public function referredUser()
    {
        return $this->belongsTo(User::class, 'referred_user_id');
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class, 'seller_referral_id');
    }

    public function monthlyHistories()
    {
        return $this->hasMany(SellerReferralMonthlyHistory::class, 'seller_referral_id');
    }
}
