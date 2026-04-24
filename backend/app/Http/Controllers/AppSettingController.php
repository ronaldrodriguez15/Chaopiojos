<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use Illuminate\Http\Request;

class AppSettingController extends Controller
{
    private const BOOKING_REQUIRE_12H_KEY = 'booking_require_12h';
    private const BOOKING_WHATSAPP_TEMPLATE_KEY = 'booking_whatsapp_confirmation_template';
    private const SELLER_REFERRAL_VALUE_KEY = 'seller_referral_value';
    private const PARTNER_COMMISSION_TIERS_KEY = 'partner_commission_tiers';
    private const TERMS_PIOJOLOGA_KEY = 'terms_conditions_piojologa';
    private const TERMS_SELLER_KEY = 'terms_conditions_vendedor';
    private const TERMS_PARTNER_KEY = 'terms_conditions_referido';

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

    private function getDefaultSellerReferralValue(): float
    {
        return 5000;
    }

    private function getDefaultPartnerCommissionTiers(): array
    {
        return [
            ['from' => 1, 'to' => 20, 'value' => 5000],
            ['from' => 21, 'to' => 40, 'value' => 7000],
            ['from' => 41, 'to' => null, 'value' => 100000],
        ];
    }

    private function getDefaultTermsConditions(): array
    {
        return [
            'piojologa' => implode("\n", [
                'Al usar este panel como piojóloga aceptas las siguientes condiciones:',
                '',
                '1. Atenderás únicamente los servicios asignados y confirmados dentro de la plataforma.',
                '2. Debes presentarte puntualmente y reportar cualquier novedad al equipo administrativo.',
                '3. La información de clientes, direcciones y teléfonos es confidencial y solo puede usarse para la prestación del servicio.',
                '4. Debes registrar correctamente el estado de cada servicio y los valores correspondientes al finalizar.',
                '5. El uso indebido de la plataforma, el maltrato a clientes o el incumplimiento reiterado podrá generar suspensión del acceso.',
            ]),
            'vendedor' => implode("\n", [
                'Al usar este panel como vendedor aceptas las siguientes condiciones:',
                '',
                '1. Compartirás únicamente enlaces, mensajes y material autorizado por Chao Piojos.',
                '2. No puedes ofrecer descuentos, beneficios o condiciones no aprobadas por la administración.',
                '3. Las comisiones solo se reconocen sobre agendamientos validados dentro del sistema.',
                '4. Debes manejar la información de prospectos y clientes con confidencialidad.',
                '5. El uso fraudulento de enlaces, registros falsos o suplantación ocasionará bloqueo inmediato del acceso.',
            ]),
            'referido' => implode("\n", [
                'Al usar este panel como establecimiento aceptas las siguientes condiciones:',
                '',
                '1. Compartirás el enlace o material comercial autorizado de Chao Piojos con tus clientes.',
                '2. La información registrada debe ser veraz y corresponder a referidos reales del establecimiento.',
                '3. La liquidación de valores o beneficios se realizará según la configuración vigente definida por la administración.',
                '4. No está permitido modificar la identidad visual, las condiciones comerciales o los mensajes oficiales sin autorización.',
                '5. El uso indebido del panel o el registro de información falsa podrá causar la suspensión del convenio y del acceso.',
            ]),
        ];
    }

    private function getTermsConditionsSettings(): array
    {
        $defaults = $this->getDefaultTermsConditions();

        return [
            'piojologa' => (string) AppSetting::getValue(self::TERMS_PIOJOLOGA_KEY, $defaults['piojologa']),
            'vendedor' => (string) AppSetting::getValue(self::TERMS_SELLER_KEY, $defaults['vendedor']),
            'referido' => (string) AppSetting::getValue(self::TERMS_PARTNER_KEY, $defaults['referido']),
        ];
    }

    private function normalizePartnerCommissionTiers($tiers): array
    {
        if (is_string($tiers) && trim($tiers) !== '') {
            $decoded = json_decode($tiers, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $tiers = $decoded;
            }
        }

        if (!is_array($tiers)) {
            return $this->getDefaultPartnerCommissionTiers();
        }

        $normalized = collect($tiers)
            ->map(function ($tier) {
                if (!is_array($tier)) {
                    return null;
                }

                $from = (int) ($tier['from'] ?? 0);
                $to = array_key_exists('to', $tier) && $tier['to'] !== null && $tier['to'] !== ''
                    ? (int) $tier['to']
                    : null;
                $value = (float) ($tier['value'] ?? 0);

                if ($from < 1 || $value < 0) {
                    return null;
                }

                if ($to !== null && $to < $from) {
                    return null;
                }

                return [
                    'from' => $from,
                    'to' => $to,
                    'value' => $value,
                ];
            })
            ->filter()
            ->sortBy('from')
            ->values()
            ->all();

        return !empty($normalized) ? $normalized : $this->getDefaultPartnerCommissionTiers();
    }

    public function bookingSettings()
    {
        $raw = AppSetting::getValue(self::BOOKING_REQUIRE_12H_KEY, '1');
        $requireAdvance12h = !in_array((string) $raw, ['0', 'false', 'False', 'FALSE'], true);
        $whatsappTemplate = AppSetting::getValue(self::BOOKING_WHATSAPP_TEMPLATE_KEY, $this->getDefaultWhatsappTemplate());
        $sellerReferralValue = (float) AppSetting::getValue(self::SELLER_REFERRAL_VALUE_KEY, (string) $this->getDefaultSellerReferralValue());
        $partnerCommissionTiers = $this->normalizePartnerCommissionTiers(
            AppSetting::getValue(
                self::PARTNER_COMMISSION_TIERS_KEY,
                json_encode($this->getDefaultPartnerCommissionTiers())
            )
        );

        return response()->json([
            'success' => true,
            'settings' => [
                'requireAdvance12h' => $requireAdvance12h,
                'whatsappConfirmationTemplate' => (string) $whatsappTemplate,
                'sellerReferralValue' => $sellerReferralValue,
                'partnerCommissionTiers' => $partnerCommissionTiers,
                'termsAndConditions' => $this->getTermsConditionsSettings(),
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
            'sellerReferralValue' => 'sometimes|numeric|min:0|max:99999999',
            'partnerCommissionTiers' => 'sometimes|array|min:1',
            'partnerCommissionTiers.*.from' => 'required_with:partnerCommissionTiers|integer|min:1|max:999999',
            'partnerCommissionTiers.*.to' => 'nullable|integer|min:1|max:999999',
            'partnerCommissionTiers.*.value' => 'required_with:partnerCommissionTiers|numeric|min:0|max:99999999',
            'termsAndConditions' => 'sometimes|array',
            'termsAndConditions.piojologa' => 'sometimes|string|min:1|max:12000',
            'termsAndConditions.vendedor' => 'sometimes|string|min:1|max:12000',
            'termsAndConditions.referido' => 'sometimes|string|min:1|max:12000',
        ]);

        if (
            !array_key_exists('requireAdvance12h', $validated)
            && !array_key_exists('whatsappConfirmationTemplate', $validated)
            && !array_key_exists('sellerReferralValue', $validated)
            && !array_key_exists('partnerCommissionTiers', $validated)
            && !array_key_exists('termsAndConditions', $validated)
        ) {
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
        if (array_key_exists('sellerReferralValue', $validated)) {
            AppSetting::setValue(self::SELLER_REFERRAL_VALUE_KEY, (float) $validated['sellerReferralValue']);
        }
        if (array_key_exists('partnerCommissionTiers', $validated)) {
            AppSetting::setValue(
                self::PARTNER_COMMISSION_TIERS_KEY,
                json_encode($this->normalizePartnerCommissionTiers($validated['partnerCommissionTiers']))
            );
        }
        if (array_key_exists('termsAndConditions', $validated)) {
            $terms = $validated['termsAndConditions'];
            if (array_key_exists('piojologa', $terms)) {
                AppSetting::setValue(self::TERMS_PIOJOLOGA_KEY, trim($terms['piojologa']));
            }
            if (array_key_exists('vendedor', $terms)) {
                AppSetting::setValue(self::TERMS_SELLER_KEY, trim($terms['vendedor']));
            }
            if (array_key_exists('referido', $terms)) {
                AppSetting::setValue(self::TERMS_PARTNER_KEY, trim($terms['referido']));
            }
        }

        $savedRequireAdvance12h = AppSetting::getValue(self::BOOKING_REQUIRE_12H_KEY, '1');
        $requireAdvance12h = !in_array((string) $savedRequireAdvance12h, ['0', 'false', 'False', 'FALSE'], true);
        $whatsappTemplate = AppSetting::getValue(self::BOOKING_WHATSAPP_TEMPLATE_KEY, $this->getDefaultWhatsappTemplate());
        $sellerReferralValue = (float) AppSetting::getValue(self::SELLER_REFERRAL_VALUE_KEY, (string) $this->getDefaultSellerReferralValue());
        $partnerCommissionTiers = $this->normalizePartnerCommissionTiers(
            AppSetting::getValue(
                self::PARTNER_COMMISSION_TIERS_KEY,
                json_encode($this->getDefaultPartnerCommissionTiers())
            )
        );

        return response()->json([
            'success' => true,
            'message' => 'Configuracion actualizada',
            'settings' => [
                'requireAdvance12h' => $requireAdvance12h,
                'whatsappConfirmationTemplate' => (string) $whatsappTemplate,
                'sellerReferralValue' => $sellerReferralValue,
                'partnerCommissionTiers' => $partnerCommissionTiers,
                'termsAndConditions' => $this->getTermsConditionsSettings(),
            ],
        ]);
    }
}
