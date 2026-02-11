<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('referral_commissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referrer_id')->constrained('users')->onDelete('cascade'); // piojóloga que refirió
            $table->foreignId('referred_id')->constrained('users')->onDelete('cascade'); // piojóloga referida
            $table->foreignId('booking_id')->constrained('bookings')->onDelete('cascade'); // reserva que generó la comisión
            $table->decimal('service_amount', 10, 2); // monto del servicio
            $table->decimal('commission_amount', 10, 2); // comisión del 10%
            $table->enum('status', ['pending', 'paid'])->default('pending');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('referral_commissions');
    }
};
