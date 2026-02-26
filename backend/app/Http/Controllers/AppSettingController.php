<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use Illuminate\Http\Request;

class AppSettingController extends Controller
{
    private const BOOKING_REQUIRE_12H_KEY = 'booking_require_12h';
    private const BOOKING_WHATSAPP_TEMPLATE_KEY = 'booking_whatsapp_confirmation_template';

    private function getDefaultWhatsappTemplate(): string
    {
        return implode("\n", [
            '*RESERVA CONFIRMADA* ✅',
            '',
            '*Chao Piojos* 🦸',
            '',
            'Nombre: {clientName}',
            'Fecha: {fecha}',
            'Hora: {hora}',
            'Dirección: {direccion}',
            '{detailsLine}',
            'Barrio: {barrio}',
            '',
            'Personas: {numPersonas}',
            'Edad: {edad}',
            '{servicesList}',
            '',
            '*Total: {total}* 💰',
            '',
            '-------------------',
            '',
            '*¿Dudas o cambios?* 📱',
            'Escríbenos al WhatsApp {businessWhatsapp}',
            '',
            '-------------------',
            '',
            '*Cómo prepararte:* ✨',
            '',
            '- Cabello seco, limpio y sin productos',
            '- Cabello desenredado',
            '- No aplicar tratamientos antipiojos antes',
            '- Ten un espacio cómodo y una toalla limpia',
            '- Informa si hay alergias',
            '- El procedimiento toma entre 30 y 60 minutos',
            '- Menores deben estar acompañados por un adulto',
            '',
            '-------------------',
            '',
            '*Cuidados después:* 🏡',
            '',
            '- Lava el cabello después de la limpieza',
            '- Cambia ropa de cama y pijamas de los últimos 3 días',
            '- Lava y desinfecta peines, cepillos, ligas, gorras',
            '- Evita compartir objetos de cabeza',
            '- Aspira sillones, almohadas, colchones',
            '- Haz revisiones semanales en casa',
            '- Viste al niño con ropa limpia tras la limpieza',
            '',
            '-------------------',
            '',
            'Confirmo mi asistencia ✅',
            'Gracias por confiar en Chao Piojos 💚',
        ]);
    }

    public function bookingSettings()
    {
        $raw = AppSetting::getValue(self::BOOKING_REQUIRE_12H_KEY, '1');
        $requireAdvance12h = !in_array((string) $raw, ['0', 'false', 'False', 'FALSE'], true);
        $whatsappTemplate = AppSetting::getValue(self::BOOKING_WHATSAPP_TEMPLATE_KEY, $this->getDefaultWhatsappTemplate());

        return response()->json([
            'success' => true,
            'settings' => [
                'requireAdvance12h' => $requireAdvance12h,
                'whatsappConfirmationTemplate' => (string) $whatsappTemplate,
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
            'requireAdvance12h' => 'sometimes|boolean',
            'whatsappConfirmationTemplate' => 'sometimes|string|min:1|max:8000',
        ]);

        if (!array_key_exists('requireAdvance12h', $validated) && !array_key_exists('whatsappConfirmationTemplate', $validated)) {
            return response()->json([
                'success' => false,
                'message' => 'No hay cambios para actualizar',
            ], 422);
        }

        if (array_key_exists('requireAdvance12h', $validated)) {
            AppSetting::setValue(self::BOOKING_REQUIRE_12H_KEY, $validated['requireAdvance12h']);
        }
        if (array_key_exists('whatsappConfirmationTemplate', $validated)) {
            AppSetting::setValue(self::BOOKING_WHATSAPP_TEMPLATE_KEY, trim($validated['whatsappConfirmationTemplate']));
        }

        $savedRequireAdvance12h = AppSetting::getValue(self::BOOKING_REQUIRE_12H_KEY, '1');
        $requireAdvance12h = !in_array((string) $savedRequireAdvance12h, ['0', 'false', 'False', 'FALSE'], true);
        $whatsappTemplate = AppSetting::getValue(self::BOOKING_WHATSAPP_TEMPLATE_KEY, $this->getDefaultWhatsappTemplate());

        return response()->json([
            'success' => true,
            'message' => 'Configuracion actualizada',
            'settings' => [
                'requireAdvance12h' => $requireAdvance12h,
                'whatsappConfirmationTemplate' => (string) $whatsappTemplate,
            ],
        ]);
    }
}
