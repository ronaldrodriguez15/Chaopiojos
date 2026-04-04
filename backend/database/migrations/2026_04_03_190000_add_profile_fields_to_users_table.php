<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 30)->nullable()->after('address');
            }

            if (!Schema::hasColumn('users', 'profile_photo_path')) {
                $table->string('profile_photo_path')->nullable()->after('phone');
            }

            if (!Schema::hasColumn('users', 'avatar_key')) {
                $table->string('avatar_key', 50)->nullable()->after('profile_photo_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $columnsToDrop = [];

            if (Schema::hasColumn('users', 'avatar_key')) {
                $columnsToDrop[] = 'avatar_key';
            }

            if (Schema::hasColumn('users', 'profile_photo_path')) {
                $columnsToDrop[] = 'profile_photo_path';
            }

            if (Schema::hasColumn('users', 'phone')) {
                $columnsToDrop[] = 'phone';
            }

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
