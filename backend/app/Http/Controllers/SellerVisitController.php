<?php

namespace App\Http\Controllers;

use App\Models\SellerVisit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SellerVisitController extends Controller
{
    protected function getPhotoPathCandidates(?string $path): array
    {
        if (!$path) {
            return [];
        }

        $normalizedPath = ltrim($path, '/\\');
        $baseName = basename($normalizedPath);

        return array_values(array_unique(array_filter([
            $normalizedPath,
            $baseName,
            'seller-visits/' . $baseName,
        ])));
    }

    protected function isRenderableImage(?string $absolutePath): bool
    {
        if (!$absolutePath || !is_file($absolutePath) || !is_readable($absolutePath)) {
            return false;
        }

        $imageInfo = @getimagesize($absolutePath);

        return is_array($imageInfo) && !empty($imageInfo['mime']);
    }

    protected function getPhotoStatus(SellerVisit $visit): string
    {
        if (!$visit->place_photo_path) {
            return 'none';
        }

        $absolutePath = $this->resolvePhotoAbsolutePath($visit->place_photo_path);
        if (!$absolutePath) {
            return 'missing';
        }

        return $this->isRenderableImage($absolutePath) ? 'available' : 'invalid';
    }

    protected function resolvePhotoAbsolutePath(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        $pathCandidates = $this->getPhotoPathCandidates($path);
        $baseName = basename(ltrim($path, '/\\'));

        foreach ($pathCandidates as $candidate) {
            if (Storage::disk('public')->exists($candidate)) {
                return Storage::disk('public')->path($candidate);
            }
        }

        $publicCandidates = [];
        foreach ($pathCandidates as $candidate) {
            $publicCandidates[] = public_path($candidate);
            $publicCandidates[] = public_path('storage/' . $candidate);
        }

        $publicCandidates[] = public_path('seller-visits/' . $baseName);
        $publicCandidates[] = public_path('storage/seller-visits/' . $baseName);
        $publicCandidates = array_values(array_unique($publicCandidates));

        foreach ($publicCandidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    protected function getThumbnailAbsolutePath(SellerVisit $sellerVisit, int $maxSize = 160): ?string
    {
        $sourcePath = $this->resolvePhotoAbsolutePath($sellerVisit->place_photo_path);
        if (!$sourcePath || !is_file($sourcePath)) {
            return null;
        }

        if (!function_exists('imagecreatefromstring')) {
            return $sourcePath;
        }

        $extension = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION) ?: 'jpg');
        $thumbDirectory = storage_path('app/public/seller-visits/thumbs');
        if (!is_dir($thumbDirectory)) {
            @mkdir($thumbDirectory, 0775, true);
        }

        $version = $sellerVisit->updated_at?->timestamp ?? $sellerVisit->id;
        $thumbFileName = sprintf('visit-%d-%d-%d.%s', $sellerVisit->id, $version, $maxSize, $extension === 'png' ? 'png' : ($extension === 'webp' ? 'webp' : 'jpg'));
        $thumbPath = $thumbDirectory . DIRECTORY_SEPARATOR . $thumbFileName;

        if (is_file($thumbPath)) {
            return $thumbPath;
        }

        $binary = @file_get_contents($sourcePath);
        if ($binary === false) {
            return $sourcePath;
        }

        $image = @imagecreatefromstring($binary);
        if (!$image) {
            return $sourcePath;
        }

        $width = imagesx($image);
        $height = imagesy($image);
        if ($width < 1 || $height < 1) {
            imagedestroy($image);
            return $sourcePath;
        }

        $scale = min($maxSize / $width, $maxSize / $height, 1);
        $targetWidth = max(1, (int) round($width * $scale));
        $targetHeight = max(1, (int) round($height * $scale));
        $thumb = imagecreatetruecolor($targetWidth, $targetHeight);

        if (in_array($extension, ['png', 'webp'], true)) {
            imagealphablending($thumb, false);
            imagesavealpha($thumb, true);
            $transparent = imagecolorallocatealpha($thumb, 0, 0, 0, 127);
            imagefill($thumb, 0, 0, $transparent);
        }

        imagecopyresampled($thumb, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        $written = match ($extension) {
            'png' => @imagepng($thumb, $thumbPath, 7),
            'webp' => function_exists('imagewebp') ? @imagewebp($thumb, $thumbPath, 82) : @imagejpeg($thumb, $thumbPath, 82),
            default => @imagejpeg($thumb, $thumbPath, 82),
        };

        imagedestroy($thumb);
        imagedestroy($image);

        return $written && is_file($thumbPath) ? $thumbPath : $sourcePath;
    }

    protected function buildFileResponse(string $absolutePath)
    {
        $imageInfo = @getimagesize($absolutePath);
        $mimeType = is_array($imageInfo) && !empty($imageInfo['mime'])
            ? $imageInfo['mime']
            : (mime_content_type($absolutePath) ?: 'application/octet-stream');

        $contents = @file_get_contents($absolutePath);

        if ($contents === false) {
            abort(404);
        }

        return response($contents, 200, [
            'Content-Type' => $mimeType,
            'Content-Length' => (string) filesize($absolutePath),
            'Cache-Control' => 'public, max-age=31536000',
            'Accept-Ranges' => 'none',
            'Cross-Origin-Resource-Policy' => 'cross-origin',
            'Content-Disposition' => 'inline; filename="' . basename($absolutePath) . '"',
        ]);
    }

    protected function buildPublicPhotoUrl(?string $path): ?string
    {
        foreach ($this->getPhotoPathCandidates($path) as $candidate) {
            if (Storage::disk('public')->exists($candidate)) {
                return Storage::disk('public')->url($candidate);
            }
        }

        if (!$path || !$this->resolvePhotoAbsolutePath($path)) {
            return null;
        }

        return Storage::disk('public')->url(ltrim($path, '/\\'));
    }

    protected function buildApiPhotoUrl(SellerVisit $visit, string $variant = 'full'): ?string
    {
        if ($this->getPhotoStatus($visit) !== 'available') {
            return null;
        }

        $photoVersion = 'media-v2-available-' . ($visit->updated_at?->timestamp ?? $visit->id);

        if ($variant === 'thumb') {
            return '/api/seller-visits/photo/' . $visit->id . '/thumb?v=' . $photoVersion;
        }

        return '/api/seller-visits/photo/' . $visit->id . '?v=' . $photoVersion;
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
        $photoStatus = $this->getPhotoStatus($visit);
        $hasUsablePhoto = $photoStatus === 'available';
        $publicPhotoUrl = $hasUsablePhoto ? $this->buildPublicPhotoUrl($visit->place_photo_path) : null;
        $apiPhotoUrl = $hasUsablePhoto ? $this->buildApiPhotoUrl($visit, 'full') : null;
        $apiThumbUrl = $hasUsablePhoto ? $this->buildApiPhotoUrl($visit, 'thumb') : null;

        return [
            'id' => $visit->id,
            'seller_user_id' => $visit->seller_user_id,
            'business_name' => $visit->business_name,
            'owner_name' => $visit->owner_name,
            'whatsapp' => $visit->whatsapp,
            'place_photo_path' => $visit->place_photo_path,
            'photo_status' => $photoStatus,
            'place_photo_url' => $publicPhotoUrl,
            'place_photo_api_url' => $apiPhotoUrl,
            'place_photo_thumb_url' => $apiThumbUrl,
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

        if (!$this->isRenderableImage($absolutePath)) {
            abort(404);
        }

        return $this->buildFileResponse($absolutePath);
    }

    public function photoThumb(SellerVisit $sellerVisit)
    {
        if ($this->getPhotoStatus($sellerVisit) !== 'available') {
            abort(404);
        }

        $absolutePath = $this->getThumbnailAbsolutePath($sellerVisit, 160);

        if (!$absolutePath) {
            abort(404);
        }

        return $this->buildFileResponse($absolutePath);
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
