<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seller_referrals', function (Blueprint $table) {
            $table->string('link_token', 64)->nullable()->unique()->after('status');
        });

        $rows = DB::table('seller_referrals')->select('id')->whereNull('link_token')->get();
        foreach ($rows as $row) {
            do {
                $token = strtolower(Str::random(24));
            } while (DB::table('seller_referrals')->where('link_token', $token)->exists());

            DB::table('seller_referrals')->where('id', $row->id)->update([
                'link_token' => $token,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('seller_referrals', function (Blueprint $table) {
            $table->dropUnique(['link_token']);
            $table->dropColumn('link_token');
        });
    }
};
