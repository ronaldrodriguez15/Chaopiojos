<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('customer_payment_provider', 40)->nullable()->after('payment_method');
            $table->string('customer_payment_status', 40)->nullable()->after('customer_payment_provider');
            $table->string('customer_payment_link_id', 80)->nullable()->after('customer_payment_status');
            $table->string('customer_payment_transaction_id', 80)->nullable()->after('customer_payment_link_id');
            $table->string('customer_payment_method', 50)->nullable()->after('customer_payment_transaction_id');
            $table->decimal('customer_payment_amount', 12, 2)->nullable()->after('customer_payment_method');
            $table->timestamp('customer_payment_paid_at')->nullable()->after('customer_payment_amount');
            $table->json('customer_payment_payload')->nullable()->after('customer_payment_paid_at');

            $table->index('customer_payment_link_id');
            $table->index('customer_payment_transaction_id');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['customer_payment_link_id']);
            $table->dropIndex(['customer_payment_transaction_id']);
            $table->dropColumn([
                'customer_payment_provider',
                'customer_payment_status',
                'customer_payment_link_id',
                'customer_payment_transaction_id',
                'customer_payment_method',
                'customer_payment_amount',
                'customer_payment_paid_at',
                'customer_payment_payload',
            ]);
        });
    }
};
