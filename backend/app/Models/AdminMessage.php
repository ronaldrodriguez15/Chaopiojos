<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AdminMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'sender_user_id',
        'recipient_user_id',
        'description',
        'attachment_path',
        'attachment_name',
        'attachment_type',
        'status',
        'admin_reply',
        'replied_by_user_id',
        'replied_at',
    ];

    protected $casts = [
        'replied_at' => 'datetime',
    ];

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function replier()
    {
        return $this->belongsTo(User::class, 'replied_by_user_id');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }
}
