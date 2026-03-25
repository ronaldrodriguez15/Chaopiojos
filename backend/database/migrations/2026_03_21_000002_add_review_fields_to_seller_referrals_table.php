<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seller_referrals', function (Blueprint $table) {
            $table->foreignId('reviewed_by_user_id')->nullable()->after('seller_user_id')->constrained('users')->nullOnDelete();
            $table->text('review_notes')->nullable()->after('status');
            $table->timestamp('reviewed_at')->nullable()->after('review_notes');
        });
    }

    public function down(): void
    {
        Schema::table('seller_referrals', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by_user_id');
            $table->dropColumn(['review_notes', 'reviewed_at']);
        });
    }
};
