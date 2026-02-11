<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ReferralCommission;
use App\Models\User;

class ReferralController extends Controller
{
    /**
     * Obtener todas las comisiones ganadas por el usuario autenticado
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function myCommissions(Request $request)
    {
        try {
            $user = $request->user();

            $commissions = ReferralCommission::where('referrer_id', $user->id)
                ->with(['referred:id,name,email', 'booking:id,clientName,fecha'])
                ->orderBy('created_at', 'desc')
                ->get();

            $totalEarned = $commissions->where('status', 'paid')->sum('commission_amount');
            $totalPending = $commissions->where('status', 'pending')->sum('commission_amount');

            return response()->json([
                'success' => true,
                'commissions' => $commissions,
                'summary' => [
                    'total_earned' => $totalEarned,
                    'total_pending' => $totalPending,
                    'total_referrals' => $commissions->count(),
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener comisiones: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener las piojólogas referidas por el usuario autenticado
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function myReferrals(Request $request)
    {
        try {
            $user = $request->user();

            $referrals = User::where('referred_by_id', $user->id)
                ->select('id', 'name', 'email', 'specialty', 'created_at')
                ->withCount('commissionsGenerated')
                ->get();

            return response()->json([
                'success' => true,
                'referrals' => $referrals
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener referidos: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estadísticas del programa de referidos (Admin)
     *
     * @return \Illuminate\Http\Response
     */
    public function statistics()
    {
        try {
            $totalCommissions = ReferralCommission::count();
            $totalPaid = ReferralCommission::where('status', 'paid')->sum('commission_amount');
            $totalPending = ReferralCommission::where('status', 'pending')->sum('commission_amount');

            $topReferrers = User::withCount('commissionsEarned')
                ->having('commissions_earned_count', '>', 0)
                ->orderBy('commissions_earned_count', 'desc')
                ->limit(10)
                ->get(['id', 'name', 'email']);

            return response()->json([
                'success' => true,
                'statistics' => [
                    'total_commissions' => $totalCommissions,
                    'total_paid' => $totalPaid,
                    'total_pending' => $totalPending,
                ],
                'top_referrers' => $topReferrers
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Marcar una comisión como pagada (Admin)
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function markAsPaid($id)
    {
        try {
            $commission = ReferralCommission::findOrFail($id);
            $commission->status = 'paid';
            $commission->save();

            return response()->json([
                'success' => true,
                'message' => 'Comisión marcada como pagada',
                'commission' => $commission
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Comisión no encontrada'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar comisión: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener todas las comisiones (Admin)
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        try {
            $commissions = ReferralCommission::with([
                'referrer:id,name,email',
                'referred:id,name,email',
                'booking:id,clientName,fecha'
            ])
            ->orderBy('created_at', 'desc')
            ->get();

            return response()->json([
                'success' => true,
                'commissions' => $commissions
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener comisiones: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Marcar todas las comisiones pendientes de una piojóloga como pagadas (Admin)
     *
     * @param  int  $referrerId
     * @return \Illuminate\Http\Response
     */
    public function markAllAsPaid($referrerId)
    {
        try {
            $updated = ReferralCommission::where('referrer_id', $referrerId)
                ->where('status', 'pending')
                ->update(['status' => 'paid']);

            return response()->json([
                'success' => true,
                'message' => "Se marcaron {$updated} comisiones como pagadas",
                'updated_count' => $updated
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar comisiones: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener historial de pagos por piojóloga (Admin)
     *
     * @return \Illuminate\Http\Response
     */
    public function paymentHistory()
    {
        try {
            $history = User::where('role', 'piojologist')
                ->withCount([
                    'commissionsEarned as total_commissions_count',
                    'commissionsEarned as pending_count' => function($query) {
                        $query->where('status', 'pending');
                    },
                    'commissionsEarned as paid_count' => function($query) {
                        $query->where('status', 'paid');
                    }
                ])
                ->withSum([
                    'commissionsEarned as total_earned' => function($query) {
                        $query->where('status', 'paid');
                    }
                ], 'commission_amount')
                ->withSum([
                    'commissionsEarned as pending_amount' => function($query) {
                        $query->where('status', 'pending');
                    }
                ], 'commission_amount')
                ->having('total_commissions_count', '>', 0)
                ->orderBy('total_earned', 'desc')
                ->get(['id', 'name', 'email', 'referral_code']);

            $totalPaid = ReferralCommission::where('status', 'paid')->sum('commission_amount');
            $totalPending = ReferralCommission::where('status', 'pending')->sum('commission_amount');

            return response()->json([
                'success' => true,
                'history' => $history,
                'summary' => [
                    'total_paid' => $totalPaid,
                    'total_pending' => $totalPending,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener historial: ' . $e->getMessage()
            ], 500);
        }
    }
}
