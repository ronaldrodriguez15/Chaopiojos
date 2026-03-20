<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    protected function ensureAdmin(Request $request)
    {
        $authUser = $request->user();

        if (!$authUser || $authUser->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Solo un administrador puede realizar esta acción'
            ], 403);
        }

        return null;
    }

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
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
            if ($response = $this->ensureAdmin($request)) {
                return $response;
            }

            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'email' => 'required|email|unique:users,email',
                'password' => 'required|string|min:3',
                'role' => ['required', Rule::in(['admin', 'piojologa'])],
                'specialty' => 'nullable|string|max:255',
                'available' => 'nullable|boolean',
                'is_active' => 'nullable|boolean',
                'address' => 'nullable|string|max:255',
                'lat' => 'nullable|numeric',
                'lng' => 'nullable|numeric',
                'referral_value' => 'nullable|numeric|min:0|max:99999999',
                'referral_code_used' => 'nullable|string|max:20',
                'referral_code' => 'nullable|string|max:20|unique:users,referral_code',
            ]);

            $validated['password'] = Hash::make($validated['password']);
            $validated['earnings'] = 0;

            if (!isset($validated['available'])) {
                $validated['available'] = true;
            }

            if (!isset($validated['is_active'])) {
                $validated['is_active'] = true;
            }

            if (($validated['role'] ?? null) === 'piojologa') {
                $validated['referral_value'] = isset($validated['referral_value'])
                    ? (float) $validated['referral_value']
                    : 15000;
            } else {
                unset($validated['referral_value']);
            }

            if ($validated['role'] === 'piojologa' && !empty($validated['referral_code_used'])) {
                $referrer = User::where('referral_code', $validated['referral_code_used'])
                    ->where('role', 'piojologa')
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
    public function show(Request $request, $id)
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
            if ($response = $this->ensureAdmin($request)) {
                return $response;
            }

            $user = User::findOrFail($id);

            $validated = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'email' => ['sometimes', 'required', 'email', Rule::unique('users')->ignore($id)],
                'password' => 'sometimes|nullable|string|min:3',
                'role' => ['sometimes', 'required', Rule::in(['admin', 'piojologa'])],
                'specialty' => 'nullable|string|max:255',
                'available' => 'nullable|boolean',
                'is_active' => 'nullable|boolean',
                'earnings' => 'nullable|numeric',
                'commission_rate' => 'nullable|numeric|min:0|max:100',
                'referral_value' => 'nullable|numeric|min:0|max:99999999',
                'address' => 'nullable|string|max:255',
                'lat' => 'nullable|numeric',
                'lng' => 'nullable|numeric',
                'referral_code' => ['nullable', 'string', 'max:20', Rule::unique('users')->ignore($id)],
            ]);

            $incomingRole = $validated['role'] ?? $user->role;
            if ($incomingRole === 'piojologa') {
                if (!array_key_exists('referral_value', $validated)) {
                    $validated['referral_value'] = $user->referral_value ?? 15000;
                } else {
                    $validated['referral_value'] = (float) $validated['referral_value'];
                }
            } else {
                unset($validated['referral_value']);
            }

            if (isset($validated['password']) && !empty($validated['password'])) {
                $validated['password'] = Hash::make($validated['password']);
            } else {
                unset($validated['password']);
            }

            if (array_key_exists('is_active', $validated) && $user->role === 'admin' && !$validated['is_active']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Los administradores no pueden ser inactivados'
                ], 422);
            }

            $user->update($validated);

            if (array_key_exists('is_active', $validated) && !$validated['is_active']) {
                $user->tokens()->delete();
            }

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
    public function destroy(Request $request, $id)
    {
        try {
            if ($response = $this->ensureAdmin($request)) {
                return $response;
            }

            $user = User::findOrFail($id);

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
                ->where('role', 'piojologa')
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
            if (request()->user()?->role !== 'admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo un administrador puede realizar esta acción'
                ], 403);
            }

            $user = User::findOrFail($id);

            if ($user->role !== 'piojologa') {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo las piojólogas pueden tener código de referido'
                ], 400);
            }

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
