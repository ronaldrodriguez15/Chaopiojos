<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class GeolocationController extends Controller
{
    protected array $reportingRoles = ['admin', 'piojologa', 'vendedor'];
    protected array $visibleRoles = ['piojologa', 'vendedor'];
    protected array $requiredLocationColumns = [
        'user_id',
        'lat',
        'lng',
        'accuracy',
        'heading',
        'speed',
        'source',
        'permission_status',
        'reported_at',
    ];

    protected function geolocationStorageReady(): bool
    {
        return Schema::hasTable('user_locations')
            && Schema::hasColumns('user_locations', $this->requiredLocationColumns);
    }

    protected function ensureAdmin(Request $request)
    {
        if ($request->user()?->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Solo un administrador puede ver la geolocalizacion',
            ], 403);
        }

        return null;
    }

    protected function serializeUserLocation(User $user): array
    {
        $location = $user->latestLocation;
        $referral = $user->managedSellerReferral;
        $reportedAt = $location?->reported_at;
        $lastSeenAt = $reportedAt ?: $location?->updated_at;
        $hasLiveCoordinates = $location && $location->lat !== null && $location->lng !== null;
        $hasProfileCoordinates = $user->lat !== null && $user->lng !== null;

        return [
            'id' => $user->id,
            'user_id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'role_label' => match ($user->role) {
                'piojologa' => 'Piojóloga',
                'vendedor' => 'Vendedor',
                'referido' => 'Establecimiento',
                default => $user->role,
            },
            'business_name' => $referral?->business_name,
            'address' => $referral?->address ?: $user->address,
            'is_active' => (bool) $user->is_active,
            'lat' => $hasLiveCoordinates ? (float) $location->lat : ($hasProfileCoordinates ? (float) $user->lat : null),
            'lng' => $hasLiveCoordinates ? (float) $location->lng : ($hasProfileCoordinates ? (float) $user->lng : null),
            'profile_lat' => $user->lat !== null ? (float) $user->lat : null,
            'profile_lng' => $user->lng !== null ? (float) $user->lng : null,
            'accuracy' => $location?->accuracy !== null ? (float) $location->accuracy : null,
            'heading' => $location?->heading !== null ? (float) $location->heading : null,
            'speed' => $location?->speed !== null ? (float) $location->speed : null,
            'source' => $hasLiveCoordinates ? ($location->source ?: 'browser') : ($hasProfileCoordinates ? 'profile' : null),
            'permission_status' => $location?->permission_status,
            'reported_at' => $reportedAt?->toIso8601String(),
            'last_seen_at' => $lastSeenAt?->toIso8601String(),
            'updated_at' => $location?->updated_at?->toIso8601String(),
            'has_live_location' => $hasLiveCoordinates,
        ];
    }

    public function index(Request $request)
    {
        if ($response = $this->ensureAdmin($request)) {
            return $response;
        }

        if (!$this->geolocationStorageReady()) {
            return response()->json([
                'success' => true,
                'supported' => false,
                'locations' => [],
                'message' => 'La tabla de geolocalizacion todavia no esta migrada en este servidor.',
                'server_time' => now()->toIso8601String(),
            ]);
        }

        $locations = User::with(['latestLocation', 'managedSellerReferral'])
            ->whereIn('role', $this->visibleRoles)
            ->orderBy('role')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->serializeUserLocation($user))
            ->values();

        return response()->json([
            'success' => true,
            'locations' => $locations,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        if (!$user || !in_array($user->role, $this->reportingRoles, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Este rol no reporta ubicacion en tiempo real',
            ], 403);
        }

        if (!$this->geolocationStorageReady()) {
            return response()->json([
                'success' => false,
                'supported' => false,
                'message' => 'La tabla de geolocalizacion todavia no esta migrada en este servidor.',
            ]);
        }

        $validated = $request->validate([
            'lat' => 'nullable|numeric|between:-90,90',
            'lng' => 'nullable|numeric|between:-180,180',
            'accuracy' => 'nullable|numeric|min:0|max:999999',
            'heading' => 'nullable|numeric|min:0|max:360',
            'speed' => 'nullable|numeric|min:0|max:999999',
            'source' => 'nullable|string|max:40',
            'permission_status' => 'nullable|string|max:40',
            'reported_at' => 'nullable|date',
        ]);

        $location = UserLocation::firstOrNew(['user_id' => $user->id]);
        $location->fill([
            'lat' => array_key_exists('lat', $validated) ? $validated['lat'] : $location->lat,
            'lng' => array_key_exists('lng', $validated) ? $validated['lng'] : $location->lng,
            'accuracy' => array_key_exists('accuracy', $validated) ? $validated['accuracy'] : $location->accuracy,
            'heading' => array_key_exists('heading', $validated) ? $validated['heading'] : $location->heading,
            'speed' => array_key_exists('speed', $validated) ? $validated['speed'] : $location->speed,
            'source' => $validated['source'] ?? ($location->source ?: 'browser'),
            'permission_status' => $validated['permission_status'] ?? $location->permission_status,
            'reported_at' => $validated['reported_at'] ?? now(),
        ]);
        $location->save();

        $user->setRelation('latestLocation', $location);
        $user->loadMissing('managedSellerReferral');

        return response()->json([
            'success' => true,
            'location' => $this->serializeUserLocation($user),
        ]);
    }
}
