<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Booking;
use App\Models\SellerReferral;
use App\Models\User;
use App\Models\ReferralCommission;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class BookingController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        $bookings = Booking::with([
                'referredBy:id,name',
                'sellerReferral:id,business_name,seller_user_id',
                'sellerReferral.seller:id,name,email',
            ])
            ->orderBy('fecha', 'asc')
            ->orderBy('hora', 'asc')
            ->get()
            ->map(function ($booking) {
                $bookingArray = $booking->toArray();

                // Si tiene referido pero no nombre, usar el nombre de la relación
                if (empty($bookingArray['referidoPor']) && !empty($bookingArray['referred_by'])) {
                    $bookingArray['referidoPor'] = $bookingArray['referred_by']['name'];
                }

                // Asegurar compatibilidad con snake_case
                if (!isset($bookingArray['referidoPor']) && isset($bookingArray['referido_por'])) {
                    $bookingArray['referidoPor'] = $bookingArray['referido_por'];
                }

                $bookingArray['seller_referral_name'] = $booking->sellerReferral?->business_name;
                $bookingArray['seller_referral'] = $booking->sellerReferral
                    ? [
                        'id' => $booking->sellerReferral->id,
                        'business_name' => $booking->sellerReferral->business_name,
                        'seller' => $booking->sellerReferral->seller
                            ? [
                                'id' => $booking->sellerReferral->seller->id,
                                'name' => $booking->sellerReferral->seller->name,
                                'email' => $booking->sellerReferral->seller->email,
                            ]
                            : null,
                    ]
                    : null;

                return $bookingArray;
            });

        return response()->json($bookings);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'fecha' => 'required|date',
            'hora' => 'required|string',
            'clientName' => 'required|string|max:255',
            'serviceType' => 'required|string',
            'servicesPerPerson' => 'nullable|array',
            'servicesPerPerson.*' => 'nullable|string',
            'whatsapp' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'direccion' => 'required|string',
            'barrio' => 'required|string|max:255',
            'descripcionUbicacion' => 'nullable|string',
            'numPersonas' => 'required|integer|min:1',
            'edad' => 'required|string|max:100',
            'hasAlergias' => 'required|boolean',
            'detalleAlergias' => 'nullable|string',
            'referidoPor' => 'nullable|string|max:255',
            'referralCode' => 'nullable|string|max:20',
            'sellerReferralToken' => 'nullable|string|max:64',
            'paymentMethod' => ['nullable', Rule::in(['pay_now', 'pay_later'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        // Validar código de referido si se proporciona
        $referredByUserId = null;
        $referidoPorName = $request->referidoPor;

        if ($request->referralCode) {
            $referrer = User::where('referral_code', $request->referralCode)
                ->whereIn('role', ['piojologa', 'vendedor'])
                ->first();

            if ($referrer) {
                $referredByUserId = $referrer->id;
                // Si hay código de referido válido, usar el nombre de la piojóloga
                $referidoPorName = $referrer->name;
            }
        }

        $referralSource = $this->resolveReferralSource(
            $request->input('referralCode'),
            $request->input('sellerReferralToken'),
            $request->input('referidoPor')
        );

        if (!$referralSource['success']) {
            return response()->json([
                'message' => 'Error de validaciÃ³n',
                'errors' => $referralSource['errors']
            ], 422);
        }

        $referredByUserId = $referralSource['referredByUserId'];
        $referidoPorName = $referralSource['referidoPor'];
        $resolvedReferralCode = $referralSource['referralCode'];
        $sellerReferralId = $referralSource['sellerReferralId'];

        $booking = Booking::create([
            'fecha' => $request->fecha,
            'hora' => $request->hora,
            'clientName' => $request->clientName,
            'serviceType' => $request->serviceType,
            'services_per_person' => $request->servicesPerPerson,
            'whatsapp' => $request->whatsapp,
            'email' => $request->email,
            'direccion' => $request->direccion,
            'barrio' => $request->barrio,
            'descripcion_ubicacion' => $request->descripcionUbicacion,
            'numPersonas' => $request->numPersonas,
            'edad' => $request->edad,
            'hasAlergias' => $request->hasAlergias,
            'detalleAlergias' => $request->detalleAlergias,
            'referidoPor' => $referidoPorName,
            'referral_code' => $resolvedReferralCode,
            'referred_by_user_id' => $referredByUserId,
            'seller_referral_id' => $sellerReferralId,
            'payment_method' => $request->paymentMethod ?? 'pay_later',
            'estado' => 'pendiente'
        ]);

        if ($referredByUserId) {
            $this->processReferralCommission($booking, 'booking_created');
        }

        return response()->json([
            'message' => 'Reserva creada exitosamente',
            'booking' => $booking
        ], 201);
    }

    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show($id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        try {
            $booking = Booking::findOrFail($id);

            Log::info('Actualizando booking', [
                'id' => $id,
                'current_payment_status' => $booking->payment_status_to_piojologist,
                'new_data' => $request->all()
            ]);

            $validator = Validator::make($request->all(), [
                'fecha' => ['nullable', 'date'],
                'hora' => ['nullable', 'string'],
                'clientName' => ['nullable', 'string', 'max:255'],
                'serviceType' => ['nullable', 'string'],
                'servicesPerPerson' => ['nullable', 'array'],
                'servicesPerPerson.*' => ['nullable', 'string'],
                'whatsapp' => ['nullable', 'string', 'max:255'],
                'email' => ['nullable', 'email', 'max:255'],
                'direccion' => ['nullable', 'string'],
                'barrio' => ['nullable', 'string', 'max:255'],
                'descripcionUbicacion' => ['nullable', 'string'],
                'lat' => ['nullable', 'numeric', 'between:-90,90'],
                'lng' => ['nullable', 'numeric', 'between:-180,180'],
                'numPersonas' => ['nullable', 'integer', 'min:1'],
                'edad' => ['nullable', 'string', 'max:100'],
                'hasAlergias' => ['nullable', 'boolean'],
                'detalleAlergias' => ['nullable', 'string'],
                'referidoPor' => ['nullable', 'string', 'max:255'],
                'referralCode' => ['nullable', 'string', 'max:20'],
                'sellerReferralToken' => ['nullable', 'string', 'max:64'],
                'referred_by_user_id' => ['nullable', 'exists:users,id'],
                'estado' => ['nullable', 'string', Rule::in(['pendiente', 'confirmado', 'completado', 'cancelado', 'assigned', 'accepted', 'rejected', 'completed'])],
                'piojologist_id' => ['nullable', 'exists:users,id'],
                'piojologistId' => ['nullable', 'exists:users,id'],
                'piojologistName' => ['nullable', 'string'],
                'status' => ['nullable', 'string'],
                'estimatedPrice' => ['nullable', 'numeric'],
                'plan_type' => ['nullable', 'string', 'max:255'],
                'price_confirmed' => ['nullable', 'numeric'],
                'service_notes' => ['nullable', 'string'],
                'additional_costs' => ['nullable', 'numeric', 'min:0'],
                'payment_status_to_piojologist' => ['nullable', 'string', Rule::in(['pending', 'paid'])],
                'paymentMethod' => ['nullable', Rule::in(['pay_now', 'pay_later'])],
                'rejection_history' => ['nullable'],
                'rejectionHistory' => ['nullable']
            ]);

        if ($validator->fails()) {
            Log::warning('Validación fallida', [
                'id' => $id,
                'errors' => $validator->errors()->toArray()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        if ($request->has('fecha')) {
            $booking->fecha = $request->fecha;
        }
        if ($request->has('hora')) {
            $booking->hora = $request->hora;
        }
        if ($request->has('clientName')) {
            $booking->clientName = $request->clientName;
        }
        if ($request->has('serviceType')) {
            $booking->serviceType = $request->serviceType;
        }
        if ($request->has('servicesPerPerson')) {
            $booking->services_per_person = $request->servicesPerPerson;
            // Si actualizan servicios por persona y no envían serviceType, usar el primero para compatibilidad.
            if (!$request->has('serviceType') && is_array($request->servicesPerPerson) && !empty($request->servicesPerPerson[0])) {
                $booking->serviceType = $request->servicesPerPerson[0];
            }
        }
        if ($request->has('whatsapp')) {
            $booking->whatsapp = $request->whatsapp;
        }
        if ($request->has('email')) {
            $booking->email = $request->email;
        }
        if ($request->has('direccion')) {
            $booking->direccion = $request->direccion;
        }
        if ($request->has('barrio')) {
            $booking->barrio = $request->barrio;
        }
        if ($request->has('descripcionUbicacion')) {
            $booking->descripcion_ubicacion = $request->descripcionUbicacion;
        }
        if ($request->has('lat')) {
            $booking->lat = $request->lat;
        }
        if ($request->has('lng')) {
            $booking->lng = $request->lng;
        }
        if ($request->has('numPersonas')) {
            $booking->numPersonas = $request->numPersonas;
        }
        if ($request->has('edad')) {
            $booking->edad = $request->edad;
        }
        if ($request->has('hasAlergias')) {
            $booking->hasAlergias = $request->boolean('hasAlergias');
        }
        if ($request->has('detalleAlergias')) {
            $booking->detalleAlergias = $request->detalleAlergias;
        }
        if ($request->has('referidoPor')) {
            $booking->referidoPor = $request->referidoPor;
        }
        if ($request->has('referred_by_user_id')) {
            $booking->referred_by_user_id = $request->referred_by_user_id;
        }
        if ($request->has('sellerReferralToken')) {
            $incomingToken = trim((string) $request->sellerReferralToken);
            if ($incomingToken === '') {
                $booking->seller_referral_id = null;
            } else {
                $resolvedSource = $this->resolveReferralSource(
                    $request->input('referralCode', $booking->referral_code),
                    $incomingToken,
                    $request->input('referidoPor', $booking->referidoPor)
                );

                if (!$resolvedSource['success']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Error de validaciÃ³n',
                        'errors' => $resolvedSource['errors']
                    ], 422);
                }

                $booking->seller_referral_id = $resolvedSource['sellerReferralId'];
                $booking->referral_code = $resolvedSource['referralCode'];
                $booking->referred_by_user_id = $resolvedSource['referredByUserId'];
                $booking->referidoPor = $resolvedSource['referidoPor'];
            }
        }
        if ($request->has('referralCode')) {
            $incomingCode = trim((string) $request->referralCode);
            if ($incomingCode === '') {
                $booking->referral_code = null;
                $booking->referred_by_user_id = null;
                $booking->seller_referral_id = null;
            } else {
                $referrer = User::where('referral_code', $incomingCode)
                    ->whereIn('role', ['piojologa', 'vendedor'])
                    ->first();

                if (!$referrer) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Error de validación',
                        'errors' => [
                            'referralCode' => ['El código de referido no es válido']
                        ]
                    ], 422);
                }

                $booking->referral_code = $incomingCode;
                $booking->referred_by_user_id = $referrer->id;
                $booking->referidoPor = $referrer->name;
                if ($referrer->role !== 'vendedor') {
                    $booking->seller_referral_id = null;
                }
            }
        }

        // Actualizar estado (acepta tanto 'estado' como 'status')
        if ($request->has('estado')) {
            $booking->estado = $request->estado;
        }
        if ($request->has('status')) {
            $booking->estado = $request->status;
            // Si se marca como completado y no se especificó payment_status, establecerlo como pending
            if ($request->status === 'completed' && !$request->has('payment_status_to_piojologist')) {
                $booking->payment_status_to_piojologist = 'pending';
            }
        }

        if ($request->has('plan_type')) {
            $booking->plan_type = $request->plan_type;
        }
        if ($request->has('price_confirmed')) {
            $booking->price_confirmed = $request->price_confirmed;
        }
        if ($request->has('service_notes')) {
            $booking->service_notes = $request->service_notes;
        }
        if ($request->has('additional_costs')) {
            $booking->additional_costs = $request->additional_costs;
        }
        if ($request->has('payment_status_to_piojologist')) {
            $booking->payment_status_to_piojologist = $request->payment_status_to_piojologist;
        }

        if ($request->has('paymentMethod')) {
            $booking->payment_method = $request->paymentMethod;
        }

        // Persistir historial de rechazos
        $normalizeHistory = function ($value) {
            if (is_array($value)) return array_values(array_filter($value));
            if (is_string($value) && trim($value) !== '') {
                try {
                    $parsed = json_decode($value, true);
                    if (is_array($parsed)) return array_values(array_filter($parsed));
                } catch (\Throwable $e) {
                    // ignore json errors
                }
                return array_values(array_filter(array_map('trim', explode(',', $value))));
            }
            return [];
        };

        $incomingHistory = null;
        if ($request->has('rejection_history')) {
            $incomingHistory = $normalizeHistory($request->input('rejection_history'));
        } elseif ($request->has('rejectionHistory')) {
            $incomingHistory = $normalizeHistory($request->input('rejectionHistory'));
        }

        if ($incomingHistory !== null) {
            $existing = $normalizeHistory($booking->rejection_history ?? []);
            $merged = array_values(array_unique(array_merge($existing, $incomingHistory)));
            $booking->rejection_history = $merged;
        }

        // Actualizar piojologist_id (acepta tanto snake_case como camelCase)
        if ($request->has('piojologist_id')) {
            $booking->piojologist_id = $request->piojologist_id;
        }
        if ($request->has('piojologistId')) {
            $booking->piojologist_id = $request->piojologistId;
        }

        // Detectar cambio a estado 'completed'
        $wasCompleted = $booking->isDirty('estado') && $booking->estado === 'completed';

        Log::info('Antes de save()', [
            'id' => $booking->id,
            'payment_status_to_piojologist' => $booking->payment_status_to_piojologist,
            'dirty_fields' => $booking->getDirty()
        ]);

        $saved = $booking->save();

        Log::info('Después de save()', [
            'id' => $booking->id,
            'save_result' => $saved,
            'updated_payment_status' => $booking->payment_status_to_piojologist,
            'fresh_from_db' => $booking->fresh()->payment_status_to_piojologist
        ]);

        // Si el booking acaba de completarse, verificar si genera comisión por referido
        if ($wasCompleted && $booking->piojologist_id) {
            $this->processReferralCommission($booking, 'booking_completed');
        }

        return response()->json([
            'message' => 'Reserva actualizada',
            'booking' => $booking
        ]);
    } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
        Log::error('Booking no encontrado', ['id' => $id]);
        return response()->json([
            'success' => false,
            'message' => 'Booking no encontrado'
        ], 404);
    } catch (\Exception $e) {
        Log::error('Error actualizando booking', [
            'id' => $id,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return response()->json([
            'success' => false,
            'message' => 'Error al actualizar: ' . $e->getMessage()
        ], 500);
    }
    }

    private function resolveReferralSource(?string $referralCode, ?string $sellerReferralToken, ?string $referidoPor): array
    {
        $resolvedReferralCode = $referralCode ? trim((string) $referralCode) : null;
        $resolvedSellerToken = $sellerReferralToken ? trim((string) $sellerReferralToken) : null;
        $resolvedReferidoPor = $referidoPor;
        $referredByUserId = null;
        $sellerReferralId = null;

        if ($resolvedSellerToken) {
            $sellerReferral = SellerReferral::with('seller:id,name,email,role,referral_code')
                ->where('link_token', $resolvedSellerToken)
                ->whereIn('status', ['pending_review', 'approved'])
                ->first();

            if (!$sellerReferral || !$sellerReferral->seller || $sellerReferral->seller->role !== 'vendedor') {
                return [
                    'success' => false,
                    'errors' => [
                        'sellerReferralToken' => ['El enlace del referido no es válido o fue desactivado']
                    ]
                ];
            }

            if (empty($sellerReferral->seller->referral_code)) {
                $sellerReferral->seller->referral_code = User::generateUniqueReferralCode('vendedor');
                $sellerReferral->seller->save();
            }

            $referredByUserId = $sellerReferral->seller->id;
            $resolvedReferidoPor = $sellerReferral->seller->name;
            $resolvedReferralCode = $sellerReferral->seller->referral_code;
            $sellerReferralId = $sellerReferral->id;
        } elseif ($resolvedReferralCode) {
            $referrer = User::where('referral_code', $resolvedReferralCode)
                ->whereIn('role', ['piojologa', 'vendedor'])
                ->first();

            if (!$referrer) {
                return [
                    'success' => false,
                    'errors' => [
                        'referralCode' => ['El codigo de referido no es valido']
                    ]
                ];
            }

            $referredByUserId = $referrer->id;
            $resolvedReferidoPor = $referrer->name;
        }

        return [
            'success' => true,
            'referidoPor' => $resolvedReferidoPor,
            'referralCode' => $resolvedReferralCode ?: null,
            'referredByUserId' => $referredByUserId,
            'sellerReferralId' => $sellerReferralId,
        ];
    }

    /**
     * Procesar comisión por referido si aplica
     *
     * @param  Booking  $booking
     * @return void
     */
    private function processReferralCommission($booking, $trigger = 'booking_completed')
    {
        try {
            // Verificar si el cliente usó un código de referido
            if (!$booking->referral_code || !$booking->referred_by_user_id) {
                // No se usó código de referido
                return;
            }

            // Verificar que no se haya generado ya una comisión para este booking
            $existingCommission = ReferralCommission::where('booking_id', $booking->id)->exists();

            if ($existingCommission) {
                // Ya existe una comisión para este booking
                return;
            }

            // Obtener la piojóloga que proporcionó el código de referido
            $referrer = User::find($booking->referred_by_user_id);

            if (!$referrer || !in_array($referrer->role, ['piojologa', 'vendedor'], true)) {
                // El referrer no es válido o no soporta comisiones
                return;
            }

            // Calcular el monto del servicio - usar price_confirmed si existe, sino intentar calcular
            $serviceAmount = $booking->price_confirmed ?? 0;

            // Si no hay precio confirmado, intentar calcular desde services_per_person
            if ($serviceAmount <= 0 && $booking->services_per_person) {
                // Aquí podrías calcular el total basado en los servicios, pero por ahora lo dejamos en 0
                // En producción, podrías obtener los precios del catálogo de servicios
                $serviceAmount = 0;
            }

            if ($referrer->role === 'vendedor') {
                if ($trigger !== 'booking_created') {
                    return;
                }

                $peopleCount = max(1, (int) ($booking->numPersonas ?? 1));
                $commissionAmount = $peopleCount * 5000;
            } else {
                if ($trigger !== 'booking_completed') {
                    return;
                }

                // Comision configurable por piojologa referidora (fallback: 15,000)
                $commissionAmount = (float) ($referrer->referral_value ?? 15000);
            }

            // Crear la comisión SIEMPRE que haya un referido válido, independientemente del monto del servicio
            ReferralCommission::create([
                'referrer_id' => $referrer->id,
                'referred_id' => null, // El referido es el cliente, no otra piojóloga
                'booking_id' => $booking->id,
                'service_amount' => $serviceAmount,
                'commission_amount' => $commissionAmount,
                'status' => 'pending',
            ]);

            Log::info('Comisión por referido creada', [
                'booking_id' => $booking->id,
                'referrer_id' => $referrer->id,
                'referrer_name' => $referrer->name,
                'commission_amount' => $commissionAmount
            ]);

        } catch (\Exception $e) {
            // Log error pero no fallar la actualización del booking
            Log::error('Error al procesar comisión por referido', [
                'booking_id' => $booking->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        try {
            $booking = Booking::findOrFail($id);

            // Solo permitir eliminar bookings en estado 'pending' o 'assigned'
            if (!in_array($booking->estado, ['pending', 'assigned', 'pendiente'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede eliminar este agendamiento. Solo se pueden eliminar agendamientos en estado "pendiente" o "asignado".',
                    'error' => 'invalid_status'
                ], 422);
            }

            // Eliminar comisiones relacionadas si existen
            ReferralCommission::where('booking_id', $booking->id)->delete();

            // Eliminar el booking
            $booking->delete();

            return response()->json([
                'success' => true,
                'message' => 'Agendamiento eliminado exitosamente'
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Agendamiento no encontrado'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error eliminando booking', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar: ' . $e->getMessage()
            ], 500);
        }
    }
}
