<?php
// CEVOC uplift hub: shared state for Questions, Stories and ADRs (owner, 26 Nov 2026).
// Stores the changes made on the hub pages (field edits, new items, soft deletes) in one SQLite file,
// ../data/cevoc.sqlite, next to the site. That file is never in git, so `git pull` of the site branch keeps it.
// GET  api/state.php              -> {"ok":true,"storage":"sqlite"}      (the page uses this to pick shared storage)
// GET  api/state.php?kind=stories -> {"ok":true,"items":{id: record}}
// POST api/state.php  {"kind":"stories","set":{"S23":{...}|null}}  -> same as GET kind (null removes the record)
// There is no login: anyone who can reach the server can change the shared state. No secrets here.
// Input is validated: known kinds, IDs of the right shape, known fields only, size limits.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const MAX_BODY = 524288;     // bytes per request
const MAX_ITEMS = 2000;      // records per kind
const MAX_TEXT = 10000;      // characters per text field
const MAX_LIST = 60;         // entries per list field

$ID = ['questions' => '/^U[1-9][0-9]{0,3}$/', 'stories' => '/^S[1-9][0-9]{0,3}$/', 'adrs' => '/^ADR-[0-9]{3,4}$/'];
$META = ['isNew' => 'bool', 'deleted' => 'bool', 'deletedAt' => 'text', 'updatedAt' => 'text', 'imported' => 'text'];
$FIELDS = [
  'questions' => ['topic' => 'text', 'q' => 'text', 'why' => 'text', 'assume' => 'text', 'who' => 'text', 'action' => 'text', 'at' => 'list',
                  'status' => 'text', 'priority' => 'text', 'phase' => 'text', 'tags' => 'text', 'answer' => 'text', 'noStoryReason' => 'text'],
  'stories'   => ['role' => 'text', 'want' => 'text', 'so' => 'text', 'screen' => 'text', 'acText' => 'text', 'qs' => 'list',
                  'priority' => 'text', 'phase' => 'text', 'user' => 'text', 'path' => 'text', 'brd' => 'list', 'tags' => 'text', 'readyOverride' => 'text', 'comment' => 'text'],
  'adrs'      => ['title' => 'text', 'context' => 'text', 'qs' => 'list', 'stories' => 'list',
                  'status' => 'text', 'decision' => 'text', 'consequences' => 'text', 'tags' => 'text', 'notes' => 'text'],
];

function out($code, $body) { http_response_code($code); echo json_encode($body, JSON_UNESCAPED_UNICODE); exit; }
function fail($code, $msg) { out($code, ['ok' => false, 'error' => $msg]); }

function db() {
  $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
  if (!is_dir($dir) && !@mkdir($dir, 0770, true)) fail(500, 'Cannot create the data folder');
  $pdo = new PDO('sqlite:' . $dir . DIRECTORY_SEPARATOR . 'cevoc.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  $pdo->exec('PRAGMA busy_timeout = 5000');
  $pdo->exec('CREATE TABLE IF NOT EXISTS state (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (kind, id))');
  return $pdo;
}

function items($pdo, $kind) {
  $st = $pdo->prepare('SELECT id, data FROM state WHERE kind = ?');
  $st->execute([$kind]);
  $res = [];
  foreach ($st as $row) $res[$row['id']] = json_decode($row['data'], true);
  return (object) $res;
}

function clean($kind, $id, $rec, $FIELDS, $META) {
  if (!is_array($rec) || ($rec !== [] && array_is_list($rec))) fail(400, "$id: record must be an object");
  $types = $FIELDS[$kind] + $META;
  $outRec = [];
  foreach ($rec as $k => $v) {
    if (!isset($types[$k])) fail(400, "$id: unknown field $k");
    $t = $types[$k];
    if ($t === 'bool') { if (!is_bool($v)) fail(400, "$id.$k must be true or false"); $outRec[$k] = $v; continue; }
    if ($t === 'list') {
      if (is_string($v)) $v = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $v)), 'strlen'));
      if (!is_array($v) || !array_is_list($v) || count($v) > MAX_LIST) fail(400, "$id.$k must be a list of up to " . MAX_LIST);
      foreach ($v as $x) if (!is_string($x) || mb_strlen($x) > 200) fail(400, "$id.$k entries must be short text");
      $outRec[$k] = $v; continue;
    }
    if ($v === null) $v = '';
    if (!is_string($v) || mb_strlen($v) > MAX_TEXT) fail(400, "$id.$k must be text up to " . MAX_TEXT . ' characters');
    $outRec[$k] = $v;
  }
  return $outRec;
}

try {
  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  if ($method === 'GET') {
    $kind = $_GET['kind'] ?? null;
    if ($kind === null) { db(); out(200, ['ok' => true, 'storage' => 'sqlite']); }
    if (!isset($FIELDS[$kind])) fail(400, 'Unknown kind');
    out(200, ['ok' => true, 'items' => items(db(), $kind)]);
  }
  if ($method !== 'POST') { header('Allow: GET, POST'); fail(405, 'Use GET or POST'); }
  if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) fail(415, 'Send application/json');
  $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
  if ($raw === false || strlen($raw) > MAX_BODY) fail(413, 'Request too large');
  $body = json_decode($raw, true);
  if (!is_array($body)) fail(400, 'Body must be JSON');
  $kind = $body['kind'] ?? null;
  $set = $body['set'] ?? null;
  if (!is_string($kind) || !isset($FIELDS[$kind])) fail(400, 'Unknown kind');
  if (!is_array($set) || ($set !== [] && array_is_list($set)) || count($set) > MAX_ITEMS) fail(400, 'set must be an object of up to ' . MAX_ITEMS . ' records');
  $clean = [];
  foreach ($set as $id => $rec) {
    $id = (string) $id;
    if (!preg_match($ID[$kind], $id)) fail(400, "Bad ID $id for $kind");
    $clean[$id] = $rec === null ? null : clean($kind, $id, $rec, $FIELDS, $META);
  }
  $pdo = db();
  $pdo->beginTransaction();
  $del = $pdo->prepare('DELETE FROM state WHERE kind = ? AND id = ?');
  $put = $pdo->prepare('INSERT INTO state (kind, id, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at');
  $now = gmdate('c');
  foreach ($clean as $id => $rec) {
    if ($rec === null) $del->execute([$kind, $id]);
    else $put->execute([$kind, $id, json_encode($rec, JSON_UNESCAPED_UNICODE), $now]);
  }
  $count = $pdo->prepare('SELECT COUNT(*) FROM state WHERE kind = ?');
  $count->execute([$kind]);
  if ((int) $count->fetchColumn() > MAX_ITEMS) { $pdo->rollBack(); fail(413, 'Too many records'); }
  $pdo->commit();
  out(200, ['ok' => true, 'items' => items($pdo, $kind)]);
} catch (Throwable $e) {
  error_log('cevoc state.php: ' . $e->getMessage());
  fail(500, 'Storage error (see the web server error log)');
}
