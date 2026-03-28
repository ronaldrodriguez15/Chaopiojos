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
        Schema::table('seller_referrals', function (Blueprint $table) {
            $table->foreignId('referred_user_id')
                ->nullable()
                ->unique()
                ->after('seller_user_id')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('seller_referrals', function (Blueprint $table) {
            $table->dropConstrainedForeignId('referred_user_id');
        });
    }
};
