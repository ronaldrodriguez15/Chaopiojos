<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        // Actualizar todos los usuarios con rol 'piojologist' a 'piojologa'
        DB::table('users')
            ->where('role', 'piojologist')
            ->update(['role' => 'piojologa']);
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        // Revertir los cambios si es necesario
        DB::table('users')
            ->where('role', 'piojologa')
            ->update(['role' => 'piojologist']);
    }
};
