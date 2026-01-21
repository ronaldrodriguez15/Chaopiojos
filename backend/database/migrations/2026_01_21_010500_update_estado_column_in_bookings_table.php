<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Ampliar la columna estado para permitir valores como assigned/accepted/rejected
        DB::statement("ALTER TABLE bookings MODIFY estado VARCHAR(32) NOT NULL DEFAULT 'pendiente'");
    }

    public function down(): void
    {
        // Volver a enum original
        DB::statement("ALTER TABLE bookings MODIFY estado ENUM('pendiente','confirmado','completado','cancelado') NOT NULL DEFAULT 'pendiente'");
    }
};
