<?php

namespace App\Http\Controllers;

use App\Models\SellerVisit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SellerVisitController extends Controller
{
    protected function resolvePhotoAbsolutePath(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        if (Storage::disk('public')->exists($path)) {
            return Storage::disk('public')->path($path);
        }

        $normalizedPath = ltrim($path, '/\\');
        $publicCandidates = [
            public_path($normalizedPath),
            public_path('storage/' . $normalizedPath),
        ];

        foreach ($publicCandidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    protected function canAccessVisits(Request $request): bool
    {
        return in_array($request->user()?->role, ['admin', 'vendedor'], true);
    }

    protected function scopeVisitsForUser(Builder $query, $user): Builder
    {
        if ($user?->role === 'vendedor') {
            $query->where('seller_user_id', $user->id);
        }

        return $query;
    }

    protected function storePhoto(?\Illuminate\Http\UploadedFile $file): ?string
    {
        if (!$file) {
            return null;
        }

        $extension = $file->getClientOriginalExtension() ?: 'bin';
        $filename = 'seller-visits/foto-lugar-' . uniqid() . '.' . $extension;
        Storage::disk('public')->putFileAs('seller-visits', $file, basename($filename));

        return $filename;
    }

    protected function serializeVisit(SellerVisit $visit): array
    {
        return [
            'id' => $visit->id,
            'seller_user_id' => $visit->seller_user_id,
            'business_name' => $visit->business_name,
            'owner_name' => $visit->owner_name,
            'whatsapp' => $visit->whatsapp,
            'place_photo_path' => $visit->place_photo_path,
            'place_photo_url' => $visit->place_photo_path
                ? url('/api/seller-visits/photo/' . $visit->id) . '?v=' . ($visit->updated_at?->timestamp ?? $visit->id)
                : null,
            'created_at' => $visit->created_at,
            'updated_at' => $visit->updated_at,
            'seller' => $visit->relationLoaded('seller') && $visit->seller
                ? [
                    'id' => $visit->seller->id,
                    'name' => $visit->seller->name,
                    'email' => $visit->seller->email,
                    'referral_code' => $visit->seller->referral_code,
                ]
                : null,
        ];
    }

    public function photo(SellerVisit $sellerVisit)
    {
        $absolutePath = $this->resolvePhotoAbsolutePath($sellerVisit->place_photo_path);

        if (!$absolutePath) {
            abort(404);
        }

        $mimeType = mime_content_type($absolutePath) ?: 'application/octet-stream';

        return response()->file($absolutePath, [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'public, max-age=31536000',
        ]);
    }

    public function index(Request $request)
    {
        try {
            if (!$this->canAccessVisits($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No tienes permisos para ver el historial de visitas',
                ], 403);
            }

            $visits = $this->scopeVisitsForUser(
                SellerVisit::with('seller:id,name,email,referral_code')->orderByDesc('created_at'),
                $request->user()
            )
                ->get()
                ->map(fn (SellerVisit $visit) => $this->serializeVisit($visit))
                ->values();

            return response()->json([
                'success' => true,
                'visits' => $visits,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cargar visitas: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            if (!in_array($request->user()?->role, ['admin', 'vendedor'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo administradores o vendedores pueden registrar visitas',
                ], 403);
            }

            $validated = $request->validate([
                'business_name' => 'required|string|max:255',
                'owner_name' => 'nullable|string|max:255',
                'whatsapp' => 'required|string|max:30',
                'place_photo' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
            ]);

            $visit = SellerVisit::create([
                'seller_user_id' => $request->user()?->role === 'vendedor' ? $request->user()->id : null,
                'business_name' => $validated['business_name'],
                'owner_name' => $validated['owner_name'] ?? null,
                'whatsapp' => $validated['whatsapp'],
                'place_photo_path' => $this->storePhoto($request->file('place_photo')),
            ]);

            $visit->load('seller:id,name,email,referral_code');

            return response()->json([
                'success' => true,
                'message' => 'Visita registrada exitosamente',
                'visit' => $this->serializeVisit($visit),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validacion',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar visita: ' . $e->getMessage(),
            ], 500);
        }
    }
}
