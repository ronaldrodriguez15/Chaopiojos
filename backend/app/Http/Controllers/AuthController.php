<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        try {
            $validated = $request->validate([
                'email' => 'required|email',
                'password' => 'required|string',
            ]);

            $user = User::where('email', $validated['email'])->first();

            if (!$user || !Hash::check($validated['password'], $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Las credenciales proporcionadas son incorrectas.'
                ], 401);
            }

            if ($user->role !== 'admin' && isset($user->is_active) && !$user->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tu cuenta está inactiva. Comunícate con administración.'
                ], 403);
            }

            // Eliminar tokens anteriores del usuario (opcional)
            $user->tokens()->delete();

            // Crear nuevo token
            $token = $user->createToken('auth-token')->plainTextToken;

            return response()->json([
                'success' => true,
                'user' => $user->fresh(),
                'token' => $token,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en el servidor: ' . $e->getMessage()
            ], 500);
        }
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada exitosamente'
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        if ($user && $user->role !== 'admin' && isset($user->is_active) && !$user->is_active) {
            $token = $user->currentAccessToken();
            if ($token) {
                $token->delete();
            }

            return response()->json([
                'success' => false,
                'message' => 'Tu cuenta está inactiva. Comunícate con administración.'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'user' => $user?->fresh()
        ]);
    }
}
