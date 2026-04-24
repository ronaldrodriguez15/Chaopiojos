<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next)
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

        return $next($request);
    }
}
