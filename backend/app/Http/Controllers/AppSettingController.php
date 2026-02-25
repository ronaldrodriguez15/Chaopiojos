<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use Illuminate\Http\Request;

class AppSettingController extends Controller
{
    private const BOOKING_REQUIRE_12H_KEY = 'booking_require_12h';

    public function bookingSettings()
    {
        $raw = AppSetting::getValue(self::BOOKING_REQUIRE_12H_KEY, '1');
        $requireAdvance12h = !in_array((string) $raw, ['0', 'false', 'False', 'FALSE'], true);

        return response()->json([
            'success' => true,
            'settings' => [
                'requireAdvance12h' => $requireAdvance12h,
            ],
        ]);
    }

    public function updateBookingSettings(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado',
            ], 403);
        }

        $validated = $request->validate([
            'requireAdvance12h' => 'required|boolean',
        ]);

        AppSetting::setValue(self::BOOKING_REQUIRE_12H_KEY, $validated['requireAdvance12h']);

        return response()->json([
            'success' => true,
            'message' => 'Configuracion actualizada',
            'settings' => [
                'requireAdvance12h' => (bool) $validated['requireAdvance12h'],
            ],
        ]);
    }
}
