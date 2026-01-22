<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Booking;
use Illuminate\Support\Facades\Validator;
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
        $bookings = Booking::orderBy('fecha', 'asc')
            ->orderBy('hora', 'asc')
            ->get();

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
            'whatsapp' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'direccion' => 'required|string',
            'barrio' => 'required|string|max:255',
            'numPersonas' => 'required|integer|min:1',
            'hasAlergias' => 'required|boolean',
            'detalleAlergias' => 'nullable|string',
            'referidoPor' => 'nullable|string|max:255',
            'paymentMethod' => ['nullable', Rule::in(['pay_now', 'pay_later'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $booking = Booking::create([
            'fecha' => $request->fecha,
            'hora' => $request->hora,
            'clientName' => $request->clientName,
            'serviceType' => $request->serviceType,
            'whatsapp' => $request->whatsapp,
            'email' => $request->email,
            'direccion' => $request->direccion,
            'barrio' => $request->barrio,
            'numPersonas' => $request->numPersonas,
            'hasAlergias' => $request->hasAlergias,
            'detalleAlergias' => $request->detalleAlergias,
            'referidoPor' => $request->referidoPor,
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
        $booking = Booking::findOrFail($id);

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
            'paymentMethod' => ['nullable', Rule::in(['pay_now', 'pay_later'])],
            'rejection_history' => ['nullable'],
            'rejectionHistory' => ['nullable']
        ]);

        if ($validator->fails()) {
            return response()->json([
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

        $booking->save();

        return response()->json([
            'message' => 'Reserva actualizada',
            'booking' => $booking
        ]);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        //
    }
}
