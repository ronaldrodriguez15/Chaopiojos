<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ICalProxyController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductRequestController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\ReferralController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

// Public routes
Route::post('/login', [AuthController::class, 'login']);
Route::get('/ical-proxy', [ICalProxyController::class, 'fetchICalFeed']);
Route::post('/bookings', [BookingController::class, 'store']); // Ruta publica para crear reservas
Route::get('/services', [ServiceController::class, 'index']);
Route::post('/validate-referral-code', [UserController::class, 'validateReferralCode']); // Validar código de referido

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Users CRUD
    Route::post('/regenerate-referral-code/{id}', [UserController::class, 'regenerateReferralCode']);
    Route::apiResource('users', UserController::class);

    // Bookings - Solo lectura para admin
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::put('/bookings/{id}', [BookingController::class, 'update']);
    Route::delete('/bookings/{id}', [BookingController::class, 'destroy']);

    // Productos
    Route::apiResource('products', ProductController::class);

    // Servicios
    Route::apiResource('services', ServiceController::class)->except(['index']);

    // Solicitudes de productos
    Route::get('/product-requests', [ProductRequestController::class, 'index']);
    Route::post('/product-requests', [ProductRequestController::class, 'store']);
    Route::put('/product-requests/{productRequest}', [ProductRequestController::class, 'update']);

    // Referidos
    Route::get('/my-referral-commissions', [ReferralController::class, 'myCommissions']);
    Route::get('/my-referrals', [ReferralController::class, 'myReferrals']);
    Route::get('/referral-commissions', [ReferralController::class, 'index']); // Admin
    Route::get('/referral-statistics', [ReferralController::class, 'statistics']); // Admin
    Route::get('/referral-payment-history', [ReferralController::class, 'paymentHistory']); // Admin
    Route::put('/referral-commissions/{id}/mark-paid', [ReferralController::class, 'markAsPaid']); // Admin
    Route::put('/referral-commissions/mark-all-paid/{referrerId}', [ReferralController::class, 'markAllAsPaid']); // Admin
    Route::delete('/product-requests/{productRequest}', [ProductRequestController::class, 'destroy']);
});
