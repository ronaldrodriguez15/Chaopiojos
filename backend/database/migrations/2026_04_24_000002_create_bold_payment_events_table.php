<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bold_payment_events', function (Blueprint $table) {
            $table->id();
            $table->uuid('notification_id')->unique();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            $table->string('event_type', 40);
            $table->string('payment_status', 40)->nullable();
            $table->string('payment_link', 80)->nullable();
            $table->string('payment_id', 80)->nullable();
            $table->string('payment_method', 50)->nullable();
            $table->string('currency', 10)->nullable();
            $table->decimal('amount_total', 12, 2)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->json('payload');
            $table->timestamps();

            $table->index('payment_link');
            $table->index('payment_id');
            $table->index('event_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bold_payment_events');
    }
};
