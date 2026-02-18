<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            DB::statement('ALTER TABLE referral_commissions DROP FOREIGN KEY referral_commissions_referred_id_foreign');
        } catch (\Throwable $e) {
            // ignore if FK does not exist
        }

        DB::statement('ALTER TABLE referral_commissions MODIFY referred_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE referral_commissions ADD CONSTRAINT referral_commissions_referred_id_foreign FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE SET NULL');

        // Backfill commissions for completed bookings with referral code where commission was not created due previous constraint
        DB::statement("
            INSERT INTO referral_commissions (referrer_id, referred_id, booking_id, service_amount, commission_amount, status, created_at, updated_at)
            SELECT
                b.referred_by_user_id AS referrer_id,
                NULL AS referred_id,
                b.id AS booking_id,
                COALESCE(b.price_confirmed, 0) AS service_amount,
                COALESCE(u.referral_value, 15000) AS commission_amount,
                'pending' AS status,
                NOW() AS created_at,
                NOW() AS updated_at
            FROM bookings b
            INNER JOIN users u ON u.id = b.referred_by_user_id
            LEFT JOIN referral_commissions rc ON rc.booking_id = b.id
            WHERE
                rc.id IS NULL
                AND b.referral_code IS NOT NULL
                AND b.referred_by_user_id IS NOT NULL
                AND b.piojologist_id IS NOT NULL
                AND b.estado IN ('completed', 'completado')
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('UPDATE referral_commissions SET referred_id = referrer_id WHERE referred_id IS NULL');

        try {
            DB::statement('ALTER TABLE referral_commissions DROP FOREIGN KEY referral_commissions_referred_id_foreign');
        } catch (\Throwable $e) {
            // ignore if FK does not exist
        }

        DB::statement('ALTER TABLE referral_commissions MODIFY referred_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE referral_commissions ADD CONSTRAINT referral_commissions_referred_id_foreign FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE');
    }
};

