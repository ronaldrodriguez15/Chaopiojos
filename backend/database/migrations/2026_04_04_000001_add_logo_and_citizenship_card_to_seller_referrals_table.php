<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seller_referrals', function (Blueprint $table) {
            if (!Schema::hasColumn('seller_referrals', 'logo_path')) {
                $table->string('logo_path')->nullable()->after('place_photo_path');
            }

            if (!Schema::hasColumn('seller_referrals', 'citizenship_card_path')) {
                $table->string('citizenship_card_path')->nullable()->after('logo_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('seller_referrals', function (Blueprint $table) {
            $columnsToDrop = [];

            if (Schema::hasColumn('seller_referrals', 'citizenship_card_path')) {
                $columnsToDrop[] = 'citizenship_card_path';
            }

            if (Schema::hasColumn('seller_referrals', 'logo_path')) {
                $columnsToDrop[] = 'logo_path';
            }

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
