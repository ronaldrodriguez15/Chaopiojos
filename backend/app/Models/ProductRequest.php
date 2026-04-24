<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'piojologist_id',
        'is_kit_completo',
        'items',
        'notes',
        'status',
        'resolved_by',
        'resolved_by_name',
        'resolved_at',
        'admin_notes'
    ];

    protected $casts = [
        'is_kit_completo' => 'boolean',
        'items' => 'array',
        'resolved_at' => 'datetime'
    ];

    public function piojologist()
    {
        return $this->belongsTo(User::class, 'piojologist_id');
    }

    public function resolver()
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
