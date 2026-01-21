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
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->string('hora');
            $table->string('clientName');
            $table->string('serviceType');
            $table->string('whatsapp');
            $table->string('email')->nullable();
            $table->text('direccion');
            $table->string('barrio');
            $table->integer('numPersonas')->default(1);
            $table->boolean('hasAlergias')->default(false);
            $table->text('detalleAlergias')->nullable();
            $table->string('referidoPor')->nullable();
            $table->enum('estado', ['pendiente', 'confirmado', 'completado', 'cancelado'])->default('pendiente');
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
        Schema::dropIfExists('bookings');
    }
};
