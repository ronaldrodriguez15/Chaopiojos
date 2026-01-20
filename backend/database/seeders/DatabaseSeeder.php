<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        // Admin user
        User::create([
            'name' => 'Admin Jefe',
            'email' => 'admin@chaopiojos.com',
            'password' => Hash::make('123'),
            'role' => 'admin',
            'address' => 'Cra 7 #45-90, Bogotá',
        ]);

        // Piojologist user
        User::create([
            'name' => 'Dr. María González',
            'email' => 'maria@chaopiojos.com',
            'password' => Hash::make('123'),
            'role' => 'piojologist',
            'specialty' => 'Experta en Rastreo',
            'available' => true,
            'earnings' => 0,
            'address' => 'Cra 11 #92-34, Bogotá',
            'lat' => 4.7110,
            'lng' => -74.0141,
        ]);
    }
}
