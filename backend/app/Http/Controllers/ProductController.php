<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    public function index()
    {
        return response()->json(Product::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'stock' => 'required|integer|min:0',
            'image' => 'nullable|string' // Acepta base64 o archivo
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        // Si la imagen es base64, convertirla y guardarla
        if (!empty($data['image']) && str_starts_with($data['image'], 'data:image')) {
            $data['image'] = $this->saveBase64Image($data['image']);
        }

        $product = Product::create($data);

        return response()->json([
            'message' => 'Producto creado',
            'product' => $product
        ], 201);
    }

    public function show(Product $product)
    {
        return response()->json($product);
    }

    public function update(Request $request, Product $product)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'price' => 'sometimes|required|numeric|min:0',
            'stock' => 'sometimes|required|integer|min:0',
            'image' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        // Si se envía una nueva imagen en base64
        if (!empty($data['image']) && str_starts_with($data['image'], 'data:image')) {
            // Eliminar imagen anterior si existe
            if ($product->image && Storage::disk('public')->exists($product->image)) {
                Storage::disk('public')->delete($product->image);
            }
            $data['image'] = $this->saveBase64Image($data['image']);
        }

        $product->update($data);

        return response()->json([
            'message' => 'Producto actualizado',
            'product' => $product
        ]);
    }

    public function destroy(Product $product)
    {
        // Eliminar imagen del storage si existe
        if ($product->image && Storage::disk('public')->exists($product->image)) {
            Storage::disk('public')->delete($product->image);
        }

        $product->delete();

        return response()->json([
            'message' => 'Producto eliminado'
        ]);
    }

    /**
     * Guardar imagen base64 en el storage
     */
    private function saveBase64Image($base64String)
    {
        // Extraer el tipo de imagen y los datos
        preg_match('/^data:image\/(\w+);base64,/', $base64String, $matches);
        $imageType = $matches[1] ?? 'png';
        $base64Data = substr($base64String, strpos($base64String, ',') + 1);

        // Decodificar base64
        $imageData = base64_decode($base64Data);

        // Generar nombre único
        $fileName = 'products/' . uniqid() . '.' . $imageType;

        // Guardar en storage/app/public/products
        Storage::disk('public')->put($fileName, $imageData);

        return $fileName;
    }
}
