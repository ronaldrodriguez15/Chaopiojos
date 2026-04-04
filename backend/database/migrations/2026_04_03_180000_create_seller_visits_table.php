<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('business_name');
            $table->string('owner_name')->nullable();
            $table->string('whatsapp', 30);
            $table->string('place_photo_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_visits');
    }
};
