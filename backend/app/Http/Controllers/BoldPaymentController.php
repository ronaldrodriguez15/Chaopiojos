<?php

namespace App\Http\Controllers;

use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class BoldPaymentController extends Controller
{
    public function createLink(Request $request)
    {
        $validated = $request->validate([
            'serviceType' => ['nullable', 'string', 'max:255'],
            'servicesPerPerson' => ['nullable', 'array'],
            'servicesPerPerson.*' => ['nullable', 'string', 'max:255'],
            'clientName' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
        ]);

        $apiKey = trim((string) config('services.bold.api_key'));

        if ($apiKey === '') {
            return response()->json([
                'success' => false,
                'message' => 'La integración con Bold no está configurada. Falta BOLD_API_KEY.',
            ], 503);
        }

        $selectedServices = collect($validated['servicesPerPerson'] ?? [$validated['serviceType'] ?? null])
            ->filter(fn ($service) => is_string($service) && trim($service) !== '')
            ->map(fn ($service) => trim($service))
            ->values();

        if ($selectedServices->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Debes seleccionar al menos un servicio para generar el link de pago.',
                'errors' => [
                    'servicesPerPerson' => ['Selecciona al menos un servicio válido.'],
                ],
            ], 422);
        }

        $serviceCatalog = Service::query()
            ->whereIn('name', $selectedServices->unique()->all())
            ->get(['name', 'value'])
            ->keyBy('name');

        $missingServices = $selectedServices->unique()->reject(
            fn ($serviceName) => $serviceCatalog->has($serviceName)
        )->values();

        if ($missingServices->isNotEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Hay servicios no válidos en la solicitud.',
                'errors' => [
                    'servicesPerPerson' => [
                        'Servicios no encontrados: ' . $missingServices->implode(', '),
                    ],
                ],
            ], 422);
        }

        $totalAmount = (int) round($selectedServices->sum(
            fn ($serviceName) => (float) ($serviceCatalog->get($serviceName)?->value ?? 0)
        ));

        if ($totalAmount < 1000) {
            return response()->json([
                'success' => false,
                'message' => 'El monto mínimo permitido para generar el link de pago es $1.000 COP.',
            ], 422);
        }

        $payload = [
            'amount_type' => 'CLOSE',
            'amount' => [
                'currency' => 'COP',
                'total_amount' => $totalAmount,
                'tip_amount' => 0,
            ],
            'reference' => 'agenda-' . now()->format('YmdHis') . '-' . Str::upper(Str::random(6)),
            'description' => $this->buildDescription($selectedServices),
        ];

        $callbackUrl = $this->resolveCallbackUrl();
        if ($callbackUrl !== null) {
            $payload['callback_url'] = $callbackUrl;
        }

        $imageUrl = trim((string) config('services.bold.image_url'));
        if ($this->isValidHttpsUrl($imageUrl)) {
            $payload['image_url'] = $imageUrl;
        }

        if (!empty($validated['email'])) {
            $payload['payer_email'] = trim((string) $validated['email']);
        }

        try {
            $response = Http::baseUrl(rtrim((string) config('services.bold.api_base_url'), '/'))
                ->acceptJson()
                ->timeout(15)
                ->withHeaders([
                    'Authorization' => 'x-api-key ' . $apiKey,
                ])
                ->post('/online/link/v1', $payload);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'No fue posible conectar con Bold para generar el link de pago.',
                'error' => $e->getMessage(),
            ], 502);
        }

        $responseData = $response->json();
        $checkoutUrl = data_get($responseData, 'payload.url');
        $paymentLink = data_get($responseData, 'payload.payment_link');

        if (!$response->successful() || !$checkoutUrl) {
            return response()->json([
                'success' => false,
                'message' => $this->extractBoldErrorMessage($responseData) ?: 'Bold no devolvió un link de pago válido.',
                'bold_status' => $response->status(),
            ], $response->status() >= 400 ? $response->status() : 502);
        }

        return response()->json([
            'success' => true,
            'url' => $checkoutUrl,
            'payment_link' => $paymentLink,
            'amount' => $totalAmount,
            'currency' => 'COP',
            'description' => $payload['description'],
        ]);
    }

    private function buildDescription(Collection $selectedServices): string
    {
        $servicesSummary = $selectedServices
            ->countBy()
            ->map(fn ($count, $serviceName) => $count > 1 ? "{$serviceName} x{$count}" : $serviceName)
            ->implode(', ');

        return Str::limit('Agendamiento Chao Piojos - ' . $servicesSummary, 100, '');
    }

    private function resolveCallbackUrl(): ?string
    {
        $configuredCallback = trim((string) config('services.bold.callback_url'));
        if ($this->isValidHttpsUrl($configuredCallback)) {
            return $configuredCallback;
        }

        $appUrl = rtrim((string) config('app.url'), '/');
        if ($this->isValidHttpsUrl($appUrl)) {
            return $appUrl . '/agenda';
        }

        return null;
    }

    private function isValidHttpsUrl(?string $url): bool
    {
        if (!$url) {
            return false;
        }

        return filter_var($url, FILTER_VALIDATE_URL) !== false
            && str_starts_with($url, 'https://');
    }

    private function extractBoldErrorMessage($responseData): ?string
    {
        if (!is_array($responseData)) {
            return null;
        }

        $errors = collect($responseData['errors'] ?? [])
            ->map(function ($error) {
                if (is_array($error)) {
                    return $error['message'] ?? $error['error'] ?? null;
                }

                return is_string($error) ? $error : null;
            })
            ->filter()
            ->values();

        if ($errors->isNotEmpty()) {
            return $errors->implode(' ');
        }

        return is_string($responseData['message'] ?? null) ? $responseData['message'] : null;
    }
}
