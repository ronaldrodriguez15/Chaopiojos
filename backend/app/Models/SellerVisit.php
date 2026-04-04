<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SellerVisit extends Model
{
    use HasFactory;

    protected $fillable = [
        'seller_user_id',
        'business_name',
        'owner_name',
        'whatsapp',
        'place_photo_path',
    ];

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_user_id');
    }
}
