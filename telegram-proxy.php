<?php
/**
 * Прокси к Telegram Bot API (обходит CORS в браузере).
 * Загрузите файл на хостинг с PHP и откройте сайт с того же домена.
 *
 * POST JSON: { "text": "..." }
 * Ответ: JSON от Telegram (поле ok: true при успехе).
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data) || empty($data['text']) || !is_string($data['text'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Missing text']);
  exit;
}

$token = '8633244693:AAFYxNx52ZqGvUq2irDoWa4_-9JWiqSW1X4';
$chat_id = '611386647';
$url = "https://api.telegram.org/bot{$token}/sendMessage";

$payload = json_encode([
  'chat_id' => $chat_id,
  'text' => $data['text'],
  'parse_mode' => 'HTML',
], JSON_UNESCAPED_UNICODE);

if (function_exists('curl_init')) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
  ]);
  $resp = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  http_response_code($code >= 200 && $code < 300 ? 200 : 502);
  echo $resp !== false ? $resp : json_encode(['ok' => false]);
  exit;
}

$ctx = stream_context_create([
  'http' => [
    'method' => 'POST',
    'header' => "Content-Type: application/json\r\n",
    'content' => $payload,
    'timeout' => 20,
  ],
]);
$resp = @file_get_contents($url, false, $ctx);
if ($resp === false) {
  http_response_code(502);
  echo json_encode(['ok' => false, 'error' => 'Request failed']);
  exit;
}
echo $resp;
