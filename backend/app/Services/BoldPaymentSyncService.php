<?php

namespace App\Services;

use App\Models\BoldPaymentEvent;
use App\Models\Booking;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;

class BoldPaymentSyncService
{
    public function shouldAutoMarkPiojologistAsPaid(?Booking $booking): bool
    {
        if (!$booking) {
            return false;
        }

        return $booking->payment_method === 'pay_now'
            && $booking->customer_payment_provider === 'bold'
            && $booking->customer_payment_status === 'paid';
    }

    public function syncBookingFromStoredEvents(Booking $booking): Booking
    {
        $event = $this->findLatestEventForBooking($booking);

        if (!$event) {
            return $booking;
        }

        return $this->applyEventToBooking($booking, $event);
    }

    public function syncBookingFromBoldFallback(Booking $booking): Booking
    {
        if (!$booking->customer_payment_link_id) {
            return $booking;
        }

        $apiKey = trim((string) config('services.bold.api_key'));
        if ($apiKey === '') {
            return $booking;
        }

        try {
            $response = Http::baseUrl(rtrim((string) config('services.bold.api_base_url'), '/'))
                ->acceptJson()
                ->timeout(15)
                ->withHeaders([
                    'Authorization' => 'x-api-key ' . $apiKey,
                ])
                ->get('/payments/webhook/notifications/' . rawurlencode($booking->customer_payment_link_id), [
                    'is_external_reference' => 'true',
                ]);
        } catch (\Throwable $e) {
            return $booking;
        }

        if (!$response->successful()) {
            return $booking;
        }

        $notifications = $response->json('notifications');
        if (!is_array($notifications) || empty($notifications)) {
            return $booking;
        }

        foreach ($notifications as $notification) {
            if (is_array($notification)) {
                $this->recordWebhookEvent($notification);
            }
        }

        return $this->syncBookingFromStoredEvents($booking->fresh());
    }

    public function recordWebhookEvent(array $payload): BoldPaymentEvent
    {
        $eventData = $this->normalizeWebhookPayload($payload);

        $event = BoldPaymentEvent::query()->updateOrCreate(
            ['notification_id' => $eventData['notification_id']],
            $eventData
        );

        $booking = $this->findBookingForEvent($event);
        if ($booking) {
            $this->applyEventToBooking($booking, $event);
        }

        return $event->fresh();
    }

    private function findLatestEventForBooking(Booking $booking): ?BoldPaymentEvent
    {
        if (!$booking->customer_payment_link_id && !$booking->customer_payment_transaction_id) {
            return null;
        }

        return BoldPaymentEvent::query()
            ->where(function ($query) use ($booking) {
                if ($booking->customer_payment_link_id) {
                    $query->where('payment_link', $booking->customer_payment_link_id);
                }

                if ($booking->customer_payment_transaction_id) {
                    $query->orWhere('payment_id', $booking->customer_payment_transaction_id);
                }
            })
            ->orderByRaw('occurred_at is null')
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->first();
    }

    private function findBookingForEvent(BoldPaymentEvent $event): ?Booking
    {
        if (!$event->payment_link && !$event->payment_id) {
            return null;
        }

        return Booking::query()
            ->where(function ($query) use ($event) {
                if ($event->payment_link) {
                    $query->where('customer_payment_link_id', $event->payment_link);
                }

                if ($event->payment_id) {
                    $query->orWhere('customer_payment_transaction_id', $event->payment_id);
                }
            })
            ->latest('id')
            ->first();
    }

    private function applyEventToBooking(Booking $booking, BoldPaymentEvent $event): Booking
    {
        $booking->payment_method = 'pay_now';
        $booking->customer_payment_provider = 'bold';
        $booking->customer_payment_status = $event->payment_status;
        $booking->customer_payment_link_id = $event->payment_link ?: $booking->customer_payment_link_id;
        $booking->customer_payment_transaction_id = $event->payment_id ?: $booking->customer_payment_transaction_id;
        $booking->customer_payment_method = $event->payment_method ?: $booking->customer_payment_method;
        $booking->customer_payment_amount = $event->amount_total ?? $booking->customer_payment_amount;
        $booking->customer_payment_paid_at = $event->paid_at ?: $booking->customer_payment_paid_at;
        $booking->customer_payment_payload = $event->payload;

        if ($booking->estado === 'completed') {
            $booking->payment_status_to_piojologist = $this->shouldAutoMarkPiojologistAsPaid($booking)
                ? 'paid'
                : 'pending';
        }

        if ($booking->isDirty()) {
            $booking->save();
        }

        if ($event->booking_id !== $booking->id) {
            $event->booking_id = $booking->id;
            $event->save();
        }

        return $booking->fresh();
    }

    private function normalizeWebhookPayload(array $payload): array
    {
        $eventType = strtoupper((string) data_get($payload, 'type', ''));
        $createdAt = $this->parseDate(data_get($payload, 'data.created_at'));
        $occurredAt = $this->parseNanosecondsTimestamp(data_get($payload, 'time')) ?: $createdAt;

        return [
            'notification_id' => $this->normalizeString(data_get($payload, 'id')),
            'event_type' => $eventType,
            'payment_status' => $this->resolvePaymentStatus($eventType),
            'payment_link' => $this->normalizeString(data_get($payload, 'data.metadata.reference')),
            'payment_id' => $this->normalizeString(data_get($payload, 'data.payment_id') ?: data_get($payload, 'subject')),
            'payment_method' => $this->normalizeString(data_get($payload, 'data.payment_method')),
            'currency' => $this->normalizeString(data_get($payload, 'data.amount.currency')),
            'amount_total' => $this->normalizeAmount(data_get($payload, 'data.amount.total')),
            'paid_at' => $createdAt,
            'occurred_at' => $occurredAt,
            'payload' => $payload,
        ];
    }

    private function resolvePaymentStatus(string $eventType): string
    {
        return match ($eventType) {
            'SALE_APPROVED' => 'paid',
            'SALE_REJECTED' => 'rejected',
            'VOID_APPROVED' => 'refunded',
            'VOID_REJECTED' => 'paid',
            default => 'pending',
        };
    }

    private function parseDate($value): ?Carbon
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function parseNanosecondsTimestamp($value): ?Carbon
    {
        if (!is_numeric($value)) {
            return null;
        }

        try {
            return Carbon::createFromTimestampUTC(((int) $value) / 1000000000);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function normalizeString($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function normalizeAmount($value): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }

        return round((float) $value, 2);
    }
}
