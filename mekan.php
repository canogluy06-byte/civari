<?php
/*
 * CİVARİ — MEKAN SAYFASI (SEO)
 * ----------------------------
 * mekan.php?id=3  → her mekanın kendi adresi olur. Sayfa sunucuda hazır
 * HTML olarak üretilir; böylece Google mekanı okuyup indeksleyebilir
 * (JavaScript ile sonradan doldurulan içeriği arama motorları göremiyordu).
 *
 * Ayrıca sayfaya JSON-LD "LocalBusiness" verisi gömülür — Google'ın
 * mekanı adres/telefon/çalışma saatiyle birlikte tanıması için.
 */
ini_set('display_errors', '0');
ini_set('log_errors', '1');
require __DIR__ . '/db.php';

function e($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

$id = (int)($_GET['id'] ?? 0);
$venue = null;
$reviews = [];
$avg = null;
$fotolar = [];

if ($id > 0 && $pdo !== null) {
    try {
        /* Yalnız onaylı mekanların sayfası açılır; onay bekleyen başvuru 404 verir.
           Sütun yoksa filtre kapanmaz — işletme kaynaklı kayıtlar dışlanır. */
        $onayKosul = " AND (source IS NULL OR source <> 'isletme')";
        try { $pdo->query("SELECT onay_durumu FROM venues LIMIT 1"); $onayKosul = " AND onay_durumu='onaylandi'"; } catch (Exception $oe) {}
        /* Yönetici oturumu açıksa başvuruyu önizleyebilir */
        if (!empty($_SESSION['admin_ok'])) $onayKosul = '';
        $sql = "SELECT * FROM venues WHERE id=? AND is_active=1 AND city='Ankara'" . $onayKosul;
        $s = $pdo->prepare($sql);
        $s->execute([$id]);
        $venue = $s->fetch();
        if ($venue) {
            $r = $pdo->prepare("SELECT user_name, rating, comment, image_url, created_at FROM reviews WHERE venue_id=? ORDER BY created_at DESC LIMIT 20");
            $r->execute([$id]);
            $reviews = $r->fetchAll();
            if ($reviews) $avg = round(array_sum(array_column($reviews, 'rating')) / count($reviews), 1);

            // Galeri fotoğrafları (tablo yoksa sessizce boş kalır)
            try {
                $g = $pdo->prepare("SELECT url, baslik FROM venue_photos WHERE venue_id=? ORDER BY sira, id");
                $g->execute([$id]);
                $fotolar = $g->fetchAll();
            } catch (Exception $ge) { $fotolar = []; }
        }
    } catch (Exception $ex) { error_log('mekan.php: ' . $ex->getMessage()); }
}

if (!$venue) {
    http_response_code(404);
    $notFound = true;
}

/* ---- Çalışma saati yardımcıları ---- */
$GUN_TR = ['Mo'=>'Pazartesi','Tu'=>'Salı','We'=>'Çarşamba','Th'=>'Perşembe','Fr'=>'Cuma','Sa'=>'Cumartesi','Su'=>'Pazar'];

/** "Mo-Sa 11:00-01:00; Su off" → insanların okuyabileceği satırlar */
function saat_satirlari(string $oh, array $gunTr): array {
    $out = [];
    foreach (explode(';', $oh) as $parca) {
        $parca = trim($parca);
        if ($parca === '') continue;
        if (preg_match('/^([A-Za-z,\-]+)\s+(.+)$/', $parca, $m)) {
            $gunler = [];
            foreach (explode(',', $m[1]) as $seg) {
                $seg = trim($seg);
                if (strpos($seg, '-') !== false) {
                    [$a, $b] = explode('-', $seg, 2);
                    $gunler[] = ($gunTr[$a] ?? $a) . ' – ' . ($gunTr[$b] ?? $b);
                } else {
                    $gunler[] = $gunTr[$seg] ?? $seg;
                }
            }
            $saat = trim($m[2]);
            $out[] = [implode(', ', $gunler), (stripos($saat, 'off') !== false || stripos($saat, 'closed') !== false) ? 'Kapalı' : $saat];
        } else {
            $out[] = ['Her gün', $parca];
        }
    }
    return $out;
}

/** Şu an açık mı? Belirsizse null döner — asla tahmin etmez. */
function acik_mi(string $oh): ?bool {
    $oh = trim($oh);
    if ($oh === '') return null;
    if (preg_match('~24\s*/\s*7~', $oh)) return true;
    $DAY = ['Mo'=>1,'Tu'=>2,'We'=>3,'Th'=>4,'Fr'=>5,'Sa'=>6,'Su'=>0];
    $today = (int)date('w');
    $mins = (int)date('G') * 60 + (int)date('i');
    $kuralGordu = false;
    foreach (explode(';', $oh) as $ham) {
        $r = trim($ham);
        if ($r === '' || preg_match('/off|closed/i', $r)) continue;
        $gunKismi = ''; $saatKismi = $r;
        if (preg_match('/^([A-Za-z,\-\s]+?)\s+(\d.*)$/', $r, $m)) { $gunKismi = trim($m[1]); $saatKismi = trim($m[2]); }
        $gunUyar = ($gunKismi === '');
        if ($gunKismi !== '') {
            foreach (explode(',', $gunKismi) as $seg) {
                $seg = trim($seg);
                if (strpos($seg, '-') !== false) {
                    [$a, $b] = explode('-', $seg, 2);
                    if (isset($DAY[$a], $DAY[$b])) {
                        $d = $DAY[$a]; $son = $DAY[$b];
                        for ($k = 0; $k < 7; $k++) { if ($d === $today) $gunUyar = true; if ($d === $son) break; $d = ($d + 1) % 7; }
                    }
                } elseif (isset($DAY[$seg]) && $DAY[$seg] === $today) $gunUyar = true;
            }
        }
        if (!$gunUyar) continue;
        if (!preg_match_all('/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/', $saatKismi, $ms, PREG_SET_ORDER)) continue;
        $kuralGordu = true;
        foreach ($ms as $p) {
            $a = (int)$p[1] * 60 + (int)$p[2];
            $b = (int)$p[3] * 60 + (int)$p[4];
            if ($b === 0) $b = 1440;
            if ($b <= $a) $b += 1440;
            if ($mins >= $a && $mins < $b) return true;
        }
    }
    return $kuralGordu ? false : null;
}

/* OSM saat biçimini schema.org'un beklediği biçime çevirir (Mo → Monday) */
function schema_saatleri(string $oh): array {
    $TAM = ['Mo'=>'Monday','Tu'=>'Tuesday','We'=>'Wednesday','Th'=>'Thursday','Fr'=>'Friday','Sa'=>'Saturday','Su'=>'Sunday'];
    $SIRA = ['Mo','Tu','We','Th','Fr','Sa','Su'];
    $spec = [];
    foreach (explode(';', $oh) as $parca) {
        $parca = trim($parca);
        if ($parca === '' || preg_match('/off|closed/i', $parca)) continue;
        if (!preg_match('/^([A-Za-z,\-]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/', $parca, $m)) continue;
        $gunler = [];
        foreach (explode(',', $m[1]) as $seg) {
            $seg = trim($seg);
            if (strpos($seg, '-') !== false) {
                [$a, $b] = explode('-', $seg, 2);
                $ia = array_search($a, $SIRA, true); $ib = array_search($b, $SIRA, true);
                if ($ia === false || $ib === false) continue;
                for ($k = 0; $k < 7; $k++) { $idx = ($ia + $k) % 7; $gunler[] = $TAM[$SIRA[$idx]]; if ($idx === $ib) break; }
            } elseif (isset($TAM[$seg])) $gunler[] = $TAM[$seg];
        }
        if (!$gunler) continue;
        $kapanis = $m[3];
        if ($kapanis === '24:00') $kapanis = '23:59';
        $spec[] = ['@type'=>'OpeningHoursSpecification', 'dayOfWeek'=>$gunler, 'opens'=>$m[2], 'closes'=>$kapanis];
    }
    return $spec;
}

$SITE = 'https://civari.com.tr';

if (!empty($notFound)):
?>
<!DOCTYPE html><html lang="tr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mekan bulunamadı — Civari</title>
<meta name="robots" content="noindex">
<style>body{font-family:'Segoe UI',system-ui,sans-serif;background:#fafafa;color:#1c1c1e;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}
a{display:inline-block;margin-top:18px;background:#ff9900;color:#fff;text-decoration:none;font-weight:700;padding:13px 30px;border-radius:30px}
h1{font-size:1.6rem;margin:0 0 8px}p{color:#64748b;margin:0}</style>
</head><body><div><h1>Bu mekan bulunamadı</h1><p>Aradığın sayfa kaldırılmış ya da adresi değişmiş olabilir.</p><a href="index.html">Ankara'yı keşfet</a></div></body></html>
<?php
exit;
endif;

$ad        = (string)$venue['name'];
$kategori  = (string)$venue['category'];
$ilce      = (string)($venue['district'] ?? '');
$adres     = (string)($venue['address'] ?? '');
$aciklama  = trim((string)($venue['description'] ?? ''));
$telefon   = (string)($venue['phone'] ?? '');
$web       = (string)($venue['website'] ?? '');
$saatler   = (string)($venue['opening_hours'] ?? '');
$foto      = (string)($venue['image_url'] ?? '');
$fiyat     = (int)($venue['price_level'] ?? 0);
$durum     = $saatler !== '' ? acik_mi($saatler) : null;

$CAT_RENK  = ['Kafe'=>'#c2761b','Restoran'=>'#e11d48','Bar'=>'#7c3aed','Tatlıcı'=>'#ec4899'];
$renk      = $CAT_RENK[$kategori] ?? '#ff9900';

$metaAciklama = $aciklama !== ''
    ? mb_substr(preg_replace('/\s+/u', ' ', $aciklama), 0, 155)
    : "$ad — Ankara" . ($ilce !== '' ? " $ilce" : '') . " bölgesinde $kategori." . ($adres !== '' ? " Adres: $adres." : '') . " Civari'de keşfet.";

/* Google için yapılandırılmış veri (JSON-LD) */
$SCHEMA_TIP = ['Kafe'=>'CafeOrCoffeeShop','Restoran'=>'Restaurant','Bar'=>'BarOrPub','Tatlıcı'=>'Bakery'];
$ld = [
    '@context' => 'https://schema.org',
    '@type'    => $SCHEMA_TIP[$kategori] ?? 'LocalBusiness',
    'name'     => $ad,
    'url'      => $SITE . '/mekan.php?id=' . $venue['id'],
    'address'  => array_filter([
        '@type'           => 'PostalAddress',
        'streetAddress'   => $adres ?: null,
        'addressLocality' => $ilce ?: 'Çankaya',
        'addressRegion'   => 'Ankara',
        'addressCountry'  => 'TR',
    ]),
    'geo' => ['@type'=>'GeoCoordinates', 'latitude'=>(float)$venue['lat'], 'longitude'=>(float)$venue['lng']],
];
if ($aciklama !== '') $ld['description'] = $aciklama;
if ($telefon !== '')  $ld['telephone']   = $telefon;
if ($web !== '')      $ld['sameAs']      = [$web];
if ($foto !== '')     $ld['image']       = $foto;
if ($fiyat > 0)       $ld['priceRange']  = str_repeat('₺', $fiyat);
if ($saatler !== '') { $sp = schema_saatleri($saatler); if ($sp) $ld['openingHoursSpecification'] = $sp; }
if ($avg !== null && count($reviews) > 0) {
    $ld['aggregateRating'] = ['@type'=>'AggregateRating', 'ratingValue'=>$avg, 'reviewCount'=>count($reviews)];
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title><?= e($ad) ?> — <?= e($kategori) ?><?= $ilce !== '' ? ', ' . e($ilce) : '' ?> Ankara | Civari</title>
<meta name="description" content="<?= e($metaAciklama) ?>">
<link rel="canonical" href="<?= e($SITE) ?>/mekan.php?id=<?= (int)$venue['id'] ?>">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Civari">
<meta property="og:title" content="<?= e($ad) ?> — <?= e($kategori) ?>, Ankara">
<meta property="og:description" content="<?= e($metaAciklama) ?>">
<meta property="og:url" content="<?= e($SITE) ?>/mekan.php?id=<?= (int)$venue['id'] ?>">
<meta property="og:image" content="<?= e($foto !== '' ? $foto : $SITE . '/icon-512.png') ?>">
<meta name="twitter:card" content="summary<?= $foto !== '' ? '_large_image' : '' ?>">
<meta name="theme-color" content="#ff9900">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="manifest" href="manifest.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="vendor/leaflet.css">
<script type="application/ld+json"><?= json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
<!-- Ölçüm kodu yalnızca çerez onayı verilmişse yüklenir (cerez.js) -->
<script>window.CİVARİ_GA_ID = 'G-4MY8MMLRQX';</script>
<script src="cerez.js?v=23" defer></script>
<style>
  :root{ --primary:#ff9900; --primary-dark:#e07f00; --ink:#1c1c1e; --muted:#64748b; --gray:#d2d2d1;
         --fd:'Bricolage Grotesque',sans-serif; --fb:'Outfit',sans-serif; --cc:<?= e($renk) ?>; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:var(--fb);color:var(--ink);background:#fafafa;line-height:1.7}
  a{color:var(--primary-dark)}
  .topbar{position:sticky;top:0;z-index:20;background:rgba(0,0,0,.92);backdrop-filter:blur(12px);
    height:calc(66px + env(safe-area-inset-top,0px));padding-top:env(safe-area-inset-top,0px);display:flex;align-items:center}
  .topbar .wrap{max-width:940px;margin:0 auto;padding:0 22px;width:100%;display:flex;align-items:center;justify-content:space-between}
  .logo{font-family:var(--fd);font-weight:800;font-size:1.5rem;color:#fff;letter-spacing:-1px;text-decoration:none}
  .logo span{color:var(--primary)}
  .back{color:#fff;text-decoration:none;font-weight:700;font-size:.9rem;background:rgba(255,255,255,.12);padding:9px 18px;border-radius:30px;transition:.2s}
  .back:hover{background:var(--primary)}

  .hero{height:300px;background-size:cover;background-position:center;position:relative;
    display:flex;align-items:center;justify-content:center}
  .hero.no-photo{background:linear-gradient(135deg,var(--cc),#1c1c1e)}
  .hero .initial{font-family:var(--fd);font-size:5rem;font-weight:800;color:rgba(255,255,255,.9)}

  .container{max-width:940px;margin:0 auto;padding:0 22px 80px}
  .head{background:#fff;border:1px solid var(--gray);border-radius:22px;padding:30px;margin-top:-56px;position:relative;z-index:5;
    box-shadow:0 22px 54px -30px rgba(0,0,0,.22)}
  .badges{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
  .cat{background:var(--cc);color:#fff;font-weight:800;font-size:.76rem;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:20px}
  .pill{font-size:.78rem;font-weight:700;padding:6px 13px;border-radius:20px;display:inline-flex;align-items:center;gap:6px}
  .pill.open{background:#dcfce7;color:#15803d}
  .pill.closed{background:#fee2e2;color:#b91c1c}
  .pill.verified{background:rgba(255,153,0,.14);color:var(--primary-dark)}
  .pill .dot{width:7px;height:7px;border-radius:50%;background:currentColor}
  h1{font-family:var(--fd);font-size:clamp(1.8rem,4.6vw,2.7rem);font-weight:800;letter-spacing:-1px;line-height:1.15;margin-bottom:8px}
  .loc{color:var(--muted);font-size:1rem}
  .price{color:var(--primary-dark);font-weight:800;margin-left:10px}
  .desc{margin-top:18px;color:#334155;font-size:1.04rem}
  .no-desc{margin-top:18px;color:var(--muted);font-style:italic;font-size:.95rem}

  .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
  .btn{display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-weight:700;font-size:.94rem;
    padding:13px 24px;border-radius:14px;border:2px solid var(--gray);color:var(--ink);background:#fff;transition:.2s}
  .btn:hover{border-color:var(--primary);color:var(--primary-dark);background:#fffaf2;transform:translateY(-2px)}
  .btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}
  .btn.primary:hover{background:var(--primary-dark);border-color:var(--primary-dark);color:#fff}

  .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:26px}
  @media (max-width:760px){ .grid{grid-template-columns:1fr} .head{padding:24px 20px} .hero{height:210px} }
  .box{background:#fff;border:1px solid var(--gray);border-radius:18px;padding:24px}
  .box h2{font-family:var(--fd);font-size:1.15rem;margin-bottom:14px}
  .hours{width:100%;border-collapse:collapse;font-size:.93rem}
  .hours td{padding:7px 0;border-bottom:1px solid #f1f5f9}
  .hours tr:last-child td{border-bottom:none}
  .hours td:last-child{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
  .info-row{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:.93rem}
  .info-row:last-child{border-bottom:none}
  .info-row span:first-child{color:var(--muted)}
  .info-row a{font-weight:700;text-decoration:none;word-break:break-all}
  #map{height:300px;border-radius:18px;border:1px solid var(--gray);margin-top:20px;z-index:1}

  /* ---- Kaydırmalı fotoğraf galerisi ---- */
  .galeri-blok{margin-top:26px}
  .galeri-ust{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}
  .galeri-ust h2{font-family:var(--fd);font-size:1.3rem;margin:0}
  .galeri-oklar{display:flex;gap:8px}
  .g-ok{width:40px;height:40px;border-radius:50%;border:1px solid var(--gray);background:#fff;color:var(--ink);
    cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:1.1rem;transition:.2s}
  .g-ok:hover{border-color:var(--primary);color:var(--primary-dark);background:#fffaf2}
  .g-ok:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
  .g-ok[disabled]{opacity:.35;cursor:default}
  .galeri{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;
    padding-bottom:8px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
  .galeri::-webkit-scrollbar{height:8px}
  .galeri::-webkit-scrollbar-thumb{background:var(--gray);border-radius:8px}
  .galeri figure{flex:0 0 auto;width:min(420px,82vw);margin:0;scroll-snap-align:start}
  .galeri img{width:100%;height:290px;object-fit:cover;border-radius:16px;border:1px solid var(--gray);display:block;background:#f1f5f9}
  .galeri figcaption{font-size:.85rem;color:var(--muted);margin-top:8px}
  @media (max-width:760px){ .galeri img{height:230px} .galeri figure{width:84vw} }
  @media (prefers-reduced-motion:reduce){ .galeri{scroll-behavior:auto} }

  /* Tam ekran görüntüleyici */
  .g-buyut{position:fixed;inset:0;background:rgba(10,8,4,.94);z-index:9999;display:none;align-items:center;justify-content:center;padding:24px}
  .g-buyut.acik{display:flex}
  .g-buyut img{max-width:94vw;max-height:88vh;border-radius:12px;object-fit:contain}
  .g-kapat{position:absolute;top:calc(18px + env(safe-area-inset-top,0px));right:20px;width:46px;height:46px;border-radius:50%;
    border:none;background:rgba(255,255,255,.15);color:#fff;font-size:1.5rem;cursor:pointer;line-height:1}
  .g-kapat:hover{background:var(--primary)}

  .reviews{margin-top:26px}
  .rv{background:#fff;border:1px solid var(--gray);border-radius:16px;padding:18px 20px;margin-bottom:12px}
  .rv-top{display:flex;justify-content:space-between;gap:12px;margin-bottom:6px}
  .rv-name{font-weight:800}
  .rv-stars{color:var(--primary)}
  .rv-text{color:#334155;font-size:.96rem}
  .rv-date{color:var(--muted);font-size:.82rem;margin-top:6px}
  .rv-empty{background:#fff;border:1px dashed var(--gray);border-radius:16px;padding:30px;text-align:center;color:var(--muted)}

  .foot{border-top:1px solid var(--gray);text-align:center;padding:26px;color:var(--muted);font-size:.85rem;background:#fff}
  .foot a{color:var(--muted);margin:0 10px;text-decoration:none}
  .foot a:hover{color:var(--primary-dark)}
</style>
</head>
<body>

<div class="topbar"><div class="wrap">
  <a class="logo" href="index.html">Civari<span>.</span></a>
  <a class="back" href="index.html">← Tüm mekanlar</a>
</div></div>

<?php if ($foto !== ''): ?>
  <div class="hero" style="background-image:url('<?= e($foto) ?>')"></div>
<?php else: ?>
  <div class="hero no-photo"><span class="initial"><?= e(mb_substr($ad, 0, 1)) ?></span></div>
<?php endif; ?>

<div class="container">
  <div class="head">
    <div class="badges">
      <span class="cat"><?= e($kategori) ?></span>
      <?php if ($durum === true): ?><span class="pill open"><span class="dot"></span>Şu an açık</span>
      <?php elseif ($durum === false): ?><span class="pill closed"><span class="dot"></span>Şu an kapalı</span><?php endif; ?>
      <?php if (!empty($venue['verified'])): ?><span class="pill verified">✓ Yerinde doğrulandı</span><?php endif; ?>
    </div>

    <h1><?= e($ad) ?></h1>
    <p class="loc">
      <?= e($adres !== '' ? $adres : ($ilce !== '' ? $ilce . ', Ankara' : 'Ankara')) ?>
      <?php if ($fiyat > 0): ?><span class="price"><?= str_repeat('₺', $fiyat) ?></span><?php endif; ?>
    </p>

    <?php if ($aciklama !== ''): ?>
      <p class="desc"><?= nl2br(e($aciklama)) ?></p>
    <?php else: ?>
      <p class="no-desc">Bu mekanın tanıtım yazısı hazırlanıyor — çok yakında burada.</p>
    <?php endif; ?>

    <div class="actions">
      <a class="btn primary" href="https://www.google.com/maps/dir/?api=1&destination=<?= (float)$venue['lat'] ?>,<?= (float)$venue['lng'] ?>" target="_blank" rel="noopener">Yol tarifi al</a>
      <?php if ($telefon !== ''): ?><a class="btn" href="tel:<?= e(preg_replace('/\s+/', '', $telefon)) ?>">Ara</a><?php endif; ?>
      <?php if ($web !== ''): ?><a class="btn" href="<?= e($web) ?>" target="_blank" rel="noopener">Web sitesi</a><?php endif; ?>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h2>Çalışma Saatleri</h2>
      <?php $satirlar = $saatler !== '' ? saat_satirlari($saatler, $GUN_TR) : []; ?>
      <?php if ($satirlar): ?>
        <table class="hours">
          <?php foreach ($satirlar as $s): ?>
            <tr><td><?= e($s[0]) ?></td><td><?= e($s[1]) ?></td></tr>
          <?php endforeach; ?>
        </table>
        <p style="color:var(--muted);font-size:.8rem;margin-top:12px">Saatler değişebilir; gitmeden önce arayarak teyit etmeni öneririz.</p>
      <?php else: ?>
        <p style="color:var(--muted)">Çalışma saati bilgisi henüz eklenmedi.</p>
      <?php endif; ?>
    </div>

    <div class="box">
      <h2>Bilgiler</h2>
      <div class="info-row"><span>Kategori</span><span><?= e($kategori) ?></span></div>
      <?php if ($ilce !== ''): ?><div class="info-row"><span>Semt</span><span><?= e($ilce) ?>, Ankara</span></div><?php endif; ?>
      <?php if ($telefon !== ''): ?><div class="info-row"><span>Telefon</span><a href="tel:<?= e(preg_replace('/\s+/', '', $telefon)) ?>"><?= e($telefon) ?></a></div><?php endif; ?>
      <?php if ($web !== ''): ?><div class="info-row"><span>Web</span><a href="<?= e($web) ?>" target="_blank" rel="noopener"><?= e(preg_replace('~^https?://~', '', $web)) ?></a></div><?php endif; ?>
      <?php if ($fiyat > 0): ?><div class="info-row"><span>Fiyat</span><span><?= str_repeat('₺', $fiyat) ?></span></div><?php endif; ?>
      <?php if (!empty($venue['tags'])): ?><div class="info-row"><span>Etiketler</span><span><?= e(str_replace(',', ', ', $venue['tags'])) ?></span></div><?php endif; ?>
    </div>
  </div>

  <?php if (count($fotolar) > 0): ?>
  <div class="galeri-blok">
    <div class="galeri-ust">
      <h2>Mekandan Kareler <span style="color:var(--muted);font-size:.9rem;font-weight:400">(<?= count($fotolar) ?> fotoğraf)</span></h2>
      <?php if (count($fotolar) > 1): ?>
      <div class="galeri-oklar">
        <button class="g-ok" id="gSol" aria-label="Önceki fotoğraf">‹</button>
        <button class="g-ok" id="gSag" aria-label="Sonraki fotoğraf">›</button>
      </div>
      <?php endif; ?>
    </div>
    <div class="galeri" id="galeri">
      <?php foreach ($fotolar as $i => $ft): ?>
        <figure>
          <img src="<?= e($ft['url']) ?>" alt="<?= e($ad . ' — fotoğraf ' . ($i+1) . ($ft['baslik'] ? ': ' . $ft['baslik'] : '')) ?>"
               loading="<?= $i < 2 ? 'eager' : 'lazy' ?>" onclick="civariBuyut(this.src)" style="cursor:zoom-in"
               onerror="this.closest('figure').style.display='none'">
          <?php if (!empty($ft['baslik'])): ?><figcaption><?= e($ft['baslik']) ?></figcaption><?php endif; ?>
        </figure>
      <?php endforeach; ?>
    </div>
  </div>
  <?php endif; ?>

  <div id="map"></div>

  <div class="reviews">
    <h2 style="font-family:var(--fd);font-size:1.3rem;margin:26px 0 14px">
      Yorumlar
      <?php if ($avg !== null): ?><span style="color:var(--primary);font-size:1rem">★ <?= e($avg) ?> · <?= count($reviews) ?> yorum</span><?php endif; ?>
    </h2>
    <?php if ($reviews): ?>
      <?php foreach ($reviews as $r): ?>
        <div class="rv">
          <div class="rv-top">
            <span class="rv-name"><?= e($r['user_name']) ?></span>
            <span class="rv-stars"><?= str_repeat('★', (int)$r['rating']) . str_repeat('☆', 5 - (int)$r['rating']) ?></span>
          </div>
          <div class="rv-text"><?= nl2br(e($r['comment'])) ?></div>
          <div class="rv-date"><?= e(date('j F Y', strtotime((string)$r['created_at']))) ?></div>
        </div>
      <?php endforeach; ?>
    <?php else: ?>
      <div class="rv-empty">Bu mekana henüz yorum yapılmamış. <a href="index.html">İlk yorumu sen bırak →</a></div>
    <?php endif; ?>
  </div>
</div>

<div class="foot">
  © <?= date('Y') ?> Civari — Ankara'nın merkezinde mekan keşfi.<br>
  <a href="index.html">Anasayfa</a> · <a href="hakkimizda.html">Hakkımızda</a> · <a href="gizlilik.html">Gizlilik</a> ·
  <a href="kvkk.html">KVKK</a> · <a href="cerez-politikasi.html">Çerez Politikası</a> ·
  <a href="kullanim-kosullari.html">Kullanım Koşulları</a> · <a href="mailto:mail@example.com">mail@example.com</a>
</div>

<!-- Fotoğraf büyütme katmanı -->
<div class="g-buyut" id="gBuyut" onclick="civariKapat()" role="dialog" aria-label="Fotoğraf görüntüleyici">
  <button class="g-kapat" onclick="civariKapat()" aria-label="Kapat">×</button>
  <img id="gBuyutResim" src="" alt="">
</div>

<script src="vendor/leaflet.js"></script>
<script>
  /* Galeri: oklarla kaydırma + tam ekran görüntüleme */
  function civariBuyut(src){
    var k = document.getElementById('gBuyut');
    document.getElementById('gBuyutResim').src = src;
    k.classList.add('acik');
    document.body.style.overflow = 'hidden';
  }
  function civariKapat(){
    document.getElementById('gBuyut').classList.remove('acik');
    document.getElementById('gBuyutResim').src = '';
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') civariKapat(); });

  (function(){
    var g = document.getElementById('galeri');
    if (!g) return;
    var sol = document.getElementById('gSol'), sag = document.getElementById('gSag');
    if (!sol || !sag) return;
    function adim(){ var f = g.querySelector('figure'); return f ? f.getBoundingClientRect().width + 14 : 320; }
    sol.addEventListener('click', function(){ g.scrollBy({ left: -adim(), behavior: 'smooth' }); });
    sag.addEventListener('click', function(){ g.scrollBy({ left:  adim(), behavior: 'smooth' }); });
    function okDurumu(){
      sol.disabled = g.scrollLeft <= 4;
      sag.disabled = g.scrollLeft + g.clientWidth >= g.scrollWidth - 4;
    }
    g.addEventListener('scroll', okDurumu, { passive: true });
    window.addEventListener('resize', okDurumu);
    okDurumu();
  })();

  (function(){
    var lat = <?= (float)$venue['lat'] ?>, lng = <?= (float)$venue['lng'] ?>;
    var map = L.map('map', { scrollWheelZoom:false }).setView([lat, lng], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution:'&copy; OpenStreetMap katkıcıları', maxZoom:19 }).addTo(map);
    L.circleMarker([lat, lng], { radius:11, color:'#fff', weight:3, fillColor:'<?= e($renk) ?>', fillOpacity:1 })
      .addTo(map).bindTooltip(<?= json_encode($ad, JSON_UNESCAPED_UNICODE) ?>, { direction:'top', offset:[0,-12] });
  })();
</script>
</body>
</html>
