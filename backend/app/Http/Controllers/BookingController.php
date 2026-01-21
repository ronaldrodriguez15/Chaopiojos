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
            'estado' => ['nullable', 'string', Rule::in(['pendiente', 'confirmado', 'completado', 'cancelado', 'assigned', 'accepted', 'rejected'])],
            'piojologist_id' => ['nullable', 'exists:users,id'],
            'piojologistId' => ['nullable', 'exists:users,id'],
            'piojologistName' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
            'estimatedPrice' => ['nullable', 'numeric']
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
