<?php

namespace App\Http\Controllers;

use App\Services\BoldPaymentSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BoldWebhookController extends Controller
{
    public function handle(Request $request, BoldPaymentSyncService $boldPaymentSync)
    {
        $rawPayload = (string) $request->getContent();
        $signature = trim((string) $request->header('x-bold-signature'));

        if (!$this->hasValidSignature($rawPayload, $signature)) {
            return response()->json([
                'status' => 'invalid_signature',
            ], 400);
        }

        $payload = json_decode($rawPayload, true);
        if (!is_array($payload) || empty($payload['id']) || empty($payload['type'])) {
            return response()->json([
                'status' => 'ignored',
            ]);
        }

        try {
            $boldPaymentSync->recordWebhookEvent($payload);
        } catch (\Throwable $e) {
            Log::error('Error procesando webhook de Bold', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'error',
            ], 500);
        }

        return response()->json([
            'status' => 'ok',
        ]);
    }

    private function hasValidSignature(string $payload, string $signature): bool
    {
        if ($signature === '') {
            return false;
        }

        $secretKey = (string) config('services.bold.secret_key', '');
        $encodedPayload = base64_encode($payload);
        $expectedSignature = hash_hmac('sha256', $encodedPayload, $secretKey);

        return hash_equals(strtolower($expectedSignature), strtolower($signature));
    }
}
