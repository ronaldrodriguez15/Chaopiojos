<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        try {
            $users = User::orderBy('created_at', 'desc')->get();

            return response()->json([
                'success' => true,
                'users' => $users
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener usuarios: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'email' => 'required|email|unique:users,email',
                'password' => 'required|string|min:3',
                'role' => ['required', Rule::in(['admin', 'piojologist'])],
                'specialty' => 'nullable|string|max:255',
                'available' => 'nullable|boolean',
                'address' => 'nullable|string|max:255',
                'lat' => 'nullable|numeric',
                'lng' => 'nullable|numeric',
                'referral_code_used' => 'nullable|string|max:20', // Código de referido ingresado
                'referral_code' => 'nullable|string|max:20|unique:users,referral_code', // Código único generado
            ]);

            $validated['password'] = Hash::make($validated['password']);
            $validated['earnings'] = 0;

            if (!isset($validated['available'])) {
                $validated['available'] = true;
            }

            // Si es piojóloga y se proporcionó un código de referido
            if ($validated['role'] === 'piojologist' && !empty($validated['referral_code_used'])) {
                $referrer = User::where('referral_code', $validated['referral_code_used'])
                    ->where('role', 'piojologist')
                    ->first();

                if ($referrer) {
                    $validated['referred_by_id'] = $referrer->id;
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => 'El código de referido no es válido'
                    ], 422);
                }
            }

            // Remover el código usado de los datos validados (no es parte del modelo)
            unset($validated['referral_code_used']);

            $user = User::create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Usuario creado exitosamente',
                'user' => $user
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear usuario: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show($id)
    {
        try {
            $user = User::findOrFail($id);

            return response()->json([
                'success' => true,
                'user' => $user
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener usuario: ' . $e->getMessage()
            ], 500);
        }
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
        try {
            $user = User::findOrFail($id);

            $validated = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'email' => ['sometimes', 'required', 'email', Rule::unique('users')->ignore($id)],
                'password' => 'sometimes|nullable|string|min:3',
                'role' => ['sometimes', 'required', Rule::in(['admin', 'piojologist'])],
                'specialty' => 'nullable|string|max:255',
                'available' => 'nullable|boolean',
                'earnings' => 'nullable|numeric',
                'commission_rate' => 'nullable|numeric|min:0|max:100',
                'address' => 'nullable|string|max:255',
                'lat' => 'nullable|numeric',
                'lng' => 'nullable|numeric',
                'referral_code' => ['nullable', 'string', 'max:20', Rule::unique('users')->ignore($id)],
            ]);

            // Si se proporciona una nueva contraseña, hashearla
            if (isset($validated['password']) && !empty($validated['password'])) {
                $validated['password'] = Hash::make($validated['password']);
            } else {
                // Si no se proporciona contraseña, no actualizarla
                unset($validated['password']);
            }

            $user->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Usuario actualizado exitosamente',
                'user' => $user->fresh()
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar usuario: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        try {
            $user = User::findOrFail($id);

            // No permitir eliminar al usuario autenticado
            if (auth()->check() && auth()->id() === $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'No puedes eliminar tu propio usuario'
                ], 403);
            }

            $user->delete();

            return response()->json([
                'success' => true,
                'message' => 'Usuario eliminado exitosamente'
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar usuario: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Validar código de referido
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function validateReferralCode(Request $request)
    {
        try {
            $validated = $request->validate([
                'code' => 'required|string|max:20',
            ]);

            $user = User::where('referral_code', $validated['code'])
                ->where('role', 'piojologist')
                ->first();

            if ($user) {
                return response()->json([
                    'success' => true,
                    'valid' => true,
                    'referrer' => [
                        'id' => $user->id,
                        'name' => $user->name,
                    ]
                ]);
            }

            return response()->json([
                'success' => true,
                'valid' => false,
                'message' => 'Código de referido no válido'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al validar código: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Regenerar código de referido para una piojóloga
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function regenerateReferralCode($id)
    {
        try {
            $user = User::findOrFail($id);

            if ($user->role !== 'piojologist') {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo las piojólogas pueden tener código de referido'
                ], 400);
            }

            // Generar nuevo código único
            $newCode = User::generateUniqueReferralCode();
            $user->referral_code = $newCode;
            $user->save();

            return response()->json([
                'success' => true,
                'message' => 'Código de referido regenerado exitosamente',
                'referral_code' => $newCode,
                'user' => $user->fresh()
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al regenerar código: ' . $e->getMessage()
            ], 500);
        }
    }
}
