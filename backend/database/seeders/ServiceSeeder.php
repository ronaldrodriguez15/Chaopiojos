<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Service;

class ServiceSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            ['name' => 'Normal', 'value' => 70000],
            ['name' => 'Elevado', 'value' => 100000],
            ['name' => 'Muy Alto', 'value' => 120000],
        ];

        foreach ($defaults as $data) {
            Service::firstOrCreate(
                ['name' => $data['name']],
                ['value' => $data['value']]
            );
        }
    }
}
