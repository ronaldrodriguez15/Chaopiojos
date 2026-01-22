<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (!Schema::hasColumn('bookings', 'price_confirmed')) {
                $table->decimal('price_confirmed', 12, 2)->nullable()->after('payment_method');
            }
            if (!Schema::hasColumn('bookings', 'plan_type')) {
                $table->string('plan_type')->nullable()->after('price_confirmed');
            }
            if (!Schema::hasColumn('bookings', 'service_notes')) {
                $table->text('service_notes')->nullable()->after('plan_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['price_confirmed', 'plan_type', 'service_notes']);
        });
    }
};
