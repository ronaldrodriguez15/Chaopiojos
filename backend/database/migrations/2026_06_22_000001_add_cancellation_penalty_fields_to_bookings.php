<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('client_key', 32)->nullable()->index()->after('whatsapp');
            $table->text('cancellation_reason')->nullable()->after('service_notes');
            $table->timestamp('cancellation_penalty_used_at')->nullable()->after('cancellation_reason');
            $table->unsignedBigInteger('penalty_source_booking_id')->nullable()->index()->after('cancellation_penalty_used_at');
        });
    }

    public function down()
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['client_key']);
            $table->dropIndex(['penalty_source_booking_id']);
            $table->dropColumn([
                'client_key',
                'cancellation_reason',
                'cancellation_penalty_used_at',
                'penalty_source_booking_id',
            ]);
        });
    }
};
