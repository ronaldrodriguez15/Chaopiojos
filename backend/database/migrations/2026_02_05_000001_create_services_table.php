<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->decimal('value', 12, 2);
            $table->timestamps();
        });

        DB::table('services')->insert([
            [
                'name' => 'Normal',
                'value' => 70000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Elevado',
                'value' => 100000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Muy Alto',
                'value' => 120000,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
