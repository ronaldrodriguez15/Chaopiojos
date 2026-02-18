<?php

namespace App\Http\Controllers;

use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ServiceController extends Controller
{
    public function index()
    {
        return response()->json(Service::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:services,name',
            'value' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Error de validaciÃ³n',
                'errors' => $validator->errors(),
            ], 422);
        }

        $service = Service::create($validator->validated());

        return response()->json([
            'message' => 'Servicio creado',
            'service' => $service,
        ], 201);
    }

    public function show(Service $service)
    {
        return response()->json($service);
    }

    public function update(Request $request, Service $service)
    {
        $validator = Validator::make($request->all(), [
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('services', 'name')->ignore($service->id),
            ],
            'value' => 'sometimes|required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Error de validaciÃ³n',
                'errors' => $validator->errors(),
            ], 422);
        }

        $service->update($validator->validated());

        return response()->json([
            'message' => 'Servicio actualizado',
            'service' => $service,
        ]);
    }

    public function destroy(Service $service)
    {
        // Verificar si el servicio está siendo usado en bookings con estado 'accepted'
        $bookingsWithService = \App\Models\Booking::where(function($query) use ($service) {
            $query->where('serviceType', $service->name)
                  ->orWhereJsonContains('services_per_person', $service->name);
        })->where('estado', 'accepted')->count();

        if ($bookingsWithService > 0) {
            return response()->json([
                'message' => 'No se puede eliminar este servicio porque está siendo usado en ' . $bookingsWithService . ' reserva(s) aceptada(s)',
                'error' => 'service_in_use'
            ], 422);
        }

        // Eliminar bookings asociados que NO estén en estado 'accepted'
        \App\Models\Booking::where(function($query) use ($service) {
            $query->where('serviceType', $service->name)
                  ->orWhereJsonContains('services_per_person', $service->name);
        })->where('estado', '!=', 'accepted')->delete();

        // Eliminar el servicio
        $service->delete();

        return response()->json([
            'message' => 'Servicio eliminado exitosamente',
        ]);
    }
}
