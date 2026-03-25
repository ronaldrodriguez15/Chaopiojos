<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('seller_referrals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_user_id')->constrained('users')->onDelete('cascade');
            $table->string('business_name');
            $table->string('owner_name')->nullable();
            $table->string('contact_name');
            $table->string('phone', 30)->nullable();
            $table->string('whatsapp', 30)->nullable();
            $table->string('email')->nullable();
            $table->string('nit', 50)->nullable();
            $table->string('city', 120)->nullable();
            $table->string('address')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 40)->default('pending_review');
            $table->string('chamber_of_commerce_path')->nullable();
            $table->string('rut_path')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('seller_referrals');
    }
};
