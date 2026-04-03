<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE seller_referrals MODIFY seller_user_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        DB::statement('UPDATE seller_referrals SET seller_user_id = reviewed_by_user_id WHERE seller_user_id IS NULL AND reviewed_by_user_id IS NOT NULL');
        DB::statement('ALTER TABLE seller_referrals MODIFY seller_user_id BIGINT UNSIGNED NOT NULL');
    }
};
