<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Booking;
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
        $bookings = Booking::with('referredBy:id,name')
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
                ->where('role', 'piojologa')
                ->first();

            if ($referrer) {
                $referredByUserId = $referrer->id;
                // Si hay código de referido válido, usar el nombre de la piojóloga
                $referidoPorName = $referrer->name;
            }
        }

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
            'referral_code' => $request->referralCode,
            'referred_by_user_id' => $referredByUserId,
            'payment_method' => $request->paymentMethod ?? 'pay_later',
            'estado' => 'pendiente'
        ]);

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
            $this->processReferralCommission($booking);
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

    /**
     * Procesar comisión por referido si aplica
     *
     * @param  Booking  $booking
     * @return void
     */
    private function processReferralCommission($booking)
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

            if (!$referrer || $referrer->role !== 'piojologa') {
                // El referrer no es válido o no es piojóloga
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

            // Comision configurable por piojologa referidora (fallback: 15,000)
            $commissionAmount = (float) ($referrer->referral_value ?? 15000);

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
