<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('plan_type')->nullable()->after('serviceType');
            $table->decimal('price_confirmed', 10, 2)->nullable()->after('plan_type');
            $table->text('service_notes')->nullable()->after('price_confirmed');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['plan_type', 'price_confirmed', 'service_notes']);
        });
    }
};
