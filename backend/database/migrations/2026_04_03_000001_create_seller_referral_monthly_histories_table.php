<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_referral_monthly_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_referral_id')->constrained('seller_referrals')->onDelete('cascade');
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedInteger('bookings_count')->default(0);
            $table->unsignedInteger('completed_bookings')->default(0);
            $table->unsignedInteger('pending_bookings')->default(0);
            $table->decimal('pending_amount', 12, 2)->default(0);
            $table->decimal('completed_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->json('tier_snapshot')->nullable();
            $table->boolean('is_closed')->default(false);
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->unique(['seller_referral_id', 'period_start'], 'seller_referral_monthly_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_referral_monthly_histories');
    }
};
