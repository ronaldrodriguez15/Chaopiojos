<?php

namespace App\Http\Controllers;

use App\Models\ProductRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ProductRequestController extends Controller
{
    public function index(Request $request)
    {
        // Admin ve todas, piojóloga solo las suyas
        $query = ProductRequest::with(['piojologist:id,name', 'resolver:id,name'])
            ->orderBy('created_at', 'desc');

        if ($request->user()->role !== 'admin') {
            $query->where('piojologist_id', $request->user()->id);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'isKitCompleto' => 'boolean',
            'items' => 'nullable|array',
            'items.*.productId' => 'required_with:items|integer',
            'items.*.productName' => 'required_with:items|string',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'notes' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        $requestModel = ProductRequest::create([
            'piojologist_id' => $request->user()->id,
            'is_kit_completo' => $data['isKitCompleto'] ?? false,
            'items' => $data['items'] ?? [],
            'notes' => $data['notes'] ?? null,
            'status' => 'pending'
        ]);

        return response()->json([
            'message' => 'Solicitud creada',
            'request' => $requestModel
        ], 201);
    }

    public function update(Request $request, ProductRequest $productRequest)
    {
        // Solo admin aprueba/rechaza
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'admin_notes' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        $productRequest->update([
            'status' => $data['status'],
            'admin_notes' => $data['admin_notes'] ?? null,
            'resolved_by' => $request->user()->id,
            'resolved_by_name' => $request->user()->name,
            'resolved_at' => now(),
        ]);

        return response()->json([
            'message' => 'Solicitud actualizada',
            'request' => $productRequest
        ]);
    }

    public function destroy(Request $request, ProductRequest $productRequest)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        $productRequest->delete();

        return response()->json(['message' => 'Solicitud eliminada']);
    }
}
