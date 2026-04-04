<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    private const ALLOWED_AVATARS = [
        'sunburst',
        'minty',
        'ocean',
        'grape',
        'flame',
        'night',
    ];

    protected function deleteProfilePhoto(?string $path): void
    {
        if ($path) {
            Storage::disk('public')->delete($path);
        }
    }

    protected function storeProfilePhoto(?\Illuminate\Http\UploadedFile $file): ?string
    {
        if (!$file) {
            return null;
        }

        $extension = $file->getClientOriginalExtension() ?: 'bin';
        $filename = 'profile-photos/user-' . uniqid() . '.' . $extension;
        Storage::disk('public')->putFileAs('profile-photos', $file, basename($filename));

        return $filename;
    }

    public function show(Request $request)
    {
        return response()->json([
            'success' => true,
            'user' => $request->user()?->fresh(),
        ]);
    }

    public function update(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado',
                ], 401);
            }

            if ($request->has('avatar_key') && trim((string) $request->input('avatar_key')) === '') {
                $request->merge(['avatar_key' => null]);
            }

            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
                'phone' => 'nullable|string|max:30',
                'address' => 'nullable|string|max:255',
                'specialty' => 'nullable|string|max:255',
                'avatar_key' => ['nullable', 'string', Rule::in(self::ALLOWED_AVATARS)],
                'profile_photo' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
                'remove_profile_photo' => 'nullable|boolean',
                'password' => 'nullable|string|min:3|confirmed',
            ]);

            $user->name = $validated['name'];
            $user->email = $validated['email'];
            $user->phone = $validated['phone'] ?? null;
            $user->address = $validated['address'] ?? null;
            $user->avatar_key = $validated['avatar_key'] ?? null;

            if ($user->role === 'piojologa') {
                $user->specialty = $validated['specialty'] ?? null;
            }

            $shouldRemoveCurrentPhoto = $request->boolean('remove_profile_photo');
            if ($shouldRemoveCurrentPhoto && $user->profile_photo_path) {
                $this->deleteProfilePhoto($user->profile_photo_path);
                $user->profile_photo_path = null;
            }

            if ($request->hasFile('profile_photo')) {
                $newPath = $this->storeProfilePhoto($request->file('profile_photo'));
                if ($newPath) {
                    $this->deleteProfilePhoto($user->profile_photo_path);
                    $user->profile_photo_path = $newPath;
                }
            }

            if (!empty($validated['password'])) {
                $user->password = Hash::make($validated['password']);
            }

            $user->save();

            return response()->json([
                'success' => true,
                'message' => 'Perfil actualizado exitosamente',
                'user' => $user->fresh(),
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar perfil: ' . $e->getMessage(),
            ], 500);
        }
    }
}
