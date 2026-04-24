<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ICalProxyController extends Controller
{
    /**
     * Proxy para obtener el feed iCal sin problemas de CORS
     */
    public function fetchICalFeed(Request $request)
    {
        $url = $request->query('url');

        if (!$url) {
            return response()->json([
                'error' => 'URL parameter is required'
            ], 400);
        }

        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'Accept' => 'text/calendar',
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                ])
                ->get($url);

            if ($response->successful()) {
                return response($response->body())
                    ->header('Content-Type', 'text/calendar')
                    ->header('Access-Control-Allow-Origin', '*');
            }

            return response()->json([
                'error' => 'Failed to fetch iCal feed'
            ], $response->status());

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch iCal feed: ' . $e->getMessage()
            ], 500);
        }
    }
}
