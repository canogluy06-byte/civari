<?php
/*
 * CİVARİ — İŞLETME PANELİ (tam sayfa)
 * -----------------------------------
 * İşletme sahibi kendi mekanını buradan yönetir: bilgiler, harita üzerinde konum,
 * çalışma saatleri, fotoğraf galerisi ve onaya gönderme.
 * Mobil öncelikli, klavyeyle kullanılabilir, ekran okuyucuya uygun.
 */
ini_set('display_errors', '0');
ini_set('log_errors', '1');
@session_start();
require __DIR__ . '/db.php';

function e($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

/* Giriş yoksa ana sayfaya gönder */
if (empty($_SESSION['user_id'])) { header('Location: index.html'); exit; }
if ($pdo === null) { die('<p style="font-family:sans-serif;padding:40px;text-align:center">Veritabanına ulaşılamadı.</p>'); }

$uid = (int)$_SESSION['user_id'];

try {
    $k = $pdo->prepare("SELECT fullname, email, hesap_turu, isletme_adi, yetkili_unvan, avatar FROM users WHERE id=?");
    $k->execute([$uid]);
    $kullanici = $k->fetch();
} catch (Throwable $ex) {
    die('<p style="font-family:sans-serif;padding:40px;text-align:center">Hesap bilgisi okunamadı.<br><small>Sunucuda <b>07_isletme.sql</b> çalıştırılmalı.</small></p>');
}

/* Yalnızca işletme hesapları */
if (!$kullanici || ($kullanici['hesap_turu'] ?? '') !== 'isletme') { header('Location: index.html'); exit; }

/* Bu işletmenin mekanı (henüz yoksa null) */
$mekan = null; $fotolar = [];
try {
    $s = $pdo->prepare("SELECT * FROM venues WHERE owner_id=? ORDER BY id LIMIT 1");
    $s->execute([$uid]);
    $mekan = $s->fetch() ?: null;
    if ($mekan) {
        $g = $pdo->prepare("SELECT id,url,sira FROM venue_photos WHERE venue_id=? ORDER BY sira, id");
        $g->execute([$mekan['id']]);
        $fotolar = $g->fetchAll();
    }
} catch (Throwable $ex) { error_log('isletme.php: ' . $ex->getMessage()); }

if (empty($_SESSION['isletme_csrf'])) $_SESSION['isletme_csrf'] = bin2hex(random_bytes(32));
$csrf = $_SESSION['isletme_csrf'];

$durum      = $mekan['onay_durumu'] ?? 'yeni';
$isletmeAdi = $kullanici['isletme_adi'] ?: $kullanici['fullname'];
$KATEGORILER = ['Kafe','Restoran','Bar','Tatlıcı'];
$GUNLER = ['Mo'=>'Pazartesi','Tu'=>'Salı','We'=>'Çarşamba','Th'=>'Perşembe','Fr'=>'Cuma','Sa'=>'Cumartesi','Su'=>'Pazar'];
?>
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>İşletme Paneli — <?= e($isletmeAdi) ?> | Civari</title>
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#ff9900">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="vendor/leaflet.css">
<style>
  :root{ --primary:#ff9900; --primary-dark:#e07f00; --ink:#1c1c1e; --muted:#64748b; --gray:#d2d2d1;
         --bg:#f7f7f8; --card:#fff; --ok:#15803d; --ok-bg:#dcfce7; --bekle:#b45309; --bekle-bg:#fef3c7;
         --red:#b91c1c; --red-bg:#fee2e2;
         --fd:'Bricolage Grotesque',sans-serif; --fb:'Outfit',sans-serif; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:var(--fb);color:var(--ink);background:var(--bg);line-height:1.6;
       padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}
  a{color:var(--primary-dark)}
  .gizli{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .atla{position:absolute;left:-999px;top:0;background:var(--primary);color:#fff;padding:12px 20px;z-index:100;border-radius:0 0 10px 0}
  .atla:focus{left:0}

  /* Üst bar */
  .ust{position:sticky;top:0;z-index:30;background:#000;color:#fff;
       height:calc(64px + env(safe-area-inset-top,0px));padding-top:env(safe-area-inset-top,0px);
       display:flex;align-items:center}
  .ust .ic{max-width:900px;margin:0 auto;padding:0 18px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .logo{font-family:var(--fd);font-weight:800;font-size:1.35rem;color:#fff;text-decoration:none;letter-spacing:-1px;flex-shrink:0}
  .logo span{color:var(--primary)}
  .ust-sag{display:flex;align-items:center;gap:8px}
  .ust-btn{color:#fff;text-decoration:none;font-weight:700;font-size:.84rem;background:rgba(255,255,255,.13);
           padding:0 16px;min-height:44px;display:inline-flex;align-items:center;
           border-radius:22px;border:none;cursor:pointer;font-family:inherit;transition:.2s;white-space:nowrap}
  .ust-btn:hover{background:var(--primary)}

  .sar{max-width:900px;margin:0 auto;padding:22px 18px 0}

  /* Başlık */
  .basl{margin-bottom:18px}
  .basl h1{font-family:var(--fd);font-size:clamp(1.5rem,4.5vw,2.1rem);font-weight:800;letter-spacing:-.6px;line-height:1.15}
  .basl p{color:var(--muted);font-size:.94rem;margin-top:4px}

  /* Durum kartı */
  .durum{border-radius:18px;padding:20px 22px;margin-bottom:20px;border:1px solid var(--gray);background:var(--card)}
  .durum.bekle{background:var(--bekle-bg);border-color:#fcd34d}
  .durum.onay{background:var(--ok-bg);border-color:#86efac}
  .durum.red{background:var(--red-bg);border-color:#fca5a5}
  .durum-ust{display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap}
  .durum-rozet{font-size:.74rem;font-weight:800;letter-spacing:.6px;text-transform:uppercase;padding:5px 12px;border-radius:20px;background:#fff}
  .durum.bekle .durum-rozet{color:var(--bekle)} .durum.onay .durum-rozet{color:var(--ok)} .durum.red .durum-rozet{color:var(--red)}
  .durum h2{font-family:var(--fd);font-size:1.12rem;font-weight:800}
  .durum p{font-size:.92rem;color:#44403c;margin-top:4px}
  .durum .link{display:inline-block;margin-top:10px;font-weight:700;font-size:.9rem}

  /* Kartlar */
  .kart{background:var(--card);border:1px solid var(--gray);border-radius:18px;padding:22px;margin-bottom:16px}
  .kart-basl{display:flex;align-items:center;gap:10px;margin-bottom:4px}
  .kart-basl h2{font-family:var(--fd);font-size:1.14rem;font-weight:800}
  .kart-no{width:26px;height:26px;border-radius:8px;background:var(--primary);color:#fff;font-size:.8rem;font-weight:800;
           display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .kart-alt{color:var(--muted);font-size:.87rem;margin-bottom:16px}

  /* Form */
  .alan{margin-bottom:15px}
  .alan label{display:block;font-weight:700;font-size:.87rem;margin-bottom:6px}
  .alan .ipucu{color:var(--muted);font-weight:400;font-size:.8rem}
  input[type=text],input[type=tel],input[type=url],input[type=number],select,textarea{
    width:100%;font-family:inherit;font-size:1rem;color:var(--ink);background:#fff;
    border:2px solid var(--gray);border-radius:12px;padding:13px 14px;transition:.15s;min-height:48px}
  textarea{min-height:120px;resize:vertical;line-height:1.6}
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 4px rgba(255,153,0,.15)}
  select{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:38px;
    background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748b' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat:no-repeat;background-position:right 14px center}
  .ikili{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:600px){ .ikili{grid-template-columns:1fr} }
  .kutu-satir{display:flex;align-items:center;gap:11px;font-size:.92rem;cursor:pointer;min-height:44px;padding:4px 0}
  .kutu-satir input[type=checkbox]{width:22px;height:22px;accent-color:var(--primary);flex-shrink:0;cursor:pointer}
  .kutu-satir:focus-within{outline:3px solid var(--primary);outline-offset:2px;border-radius:8px}
  .sayac{font-size:.78rem;color:var(--muted);text-align:right;margin-top:4px}

  /* Harita */
  #harita{height:320px;border-radius:14px;border:2px solid var(--gray);margin-top:10px;z-index:1}
  .adres-ara{display:flex;gap:8px;margin-bottom:10px}
  .adres-ara input{flex:1}
  .btn-ara{background:var(--ink);color:#fff;border:none;border-radius:12px;padding:0 20px;font-weight:700;
           font-family:inherit;cursor:pointer;white-space:nowrap;min-height:48px;transition:.2s}
  .btn-ara:hover{background:var(--primary)}
  .konum-bilgi{font-size:.83rem;color:var(--muted);margin-top:8px;font-variant-numeric:tabular-nums}
  .konum-bilgi b{color:var(--ok)}

  /* Saatler */
  .saat-satir{display:grid;grid-template-columns:110px 1fr auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #f1f5f9}
  .saat-satir:last-child{border-bottom:none}
  .saat-satir .gun{font-weight:700;font-size:.9rem}
  .saat-kutular{display:flex;align-items:center;gap:7px}
  .saat-kutular input{width:100px;min-height:44px;padding:9px 10px;text-align:center;font-variant-numeric:tabular-nums}
  .saat-kutular span{color:var(--muted)}
  /* Dokunma hedefi en az 44px — etiketin tamamı tıklanabilir */
  .kapali-etiket{font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:8px;cursor:pointer;
                 white-space:nowrap;min-height:44px;padding:0 10px;border-radius:10px;transition:background .15s}
  .kapali-etiket:hover{background:#f6f6f7}
  .kapali-etiket input{width:22px;height:22px;accent-color:var(--primary);cursor:pointer;flex-shrink:0}
  .kapali-etiket:focus-within{outline:3px solid var(--primary);outline-offset:1px}
  @media(max-width:600px){
    .saat-satir{grid-template-columns:1fr;gap:6px;padding:12px 0}
    .saat-kutular input{flex:1;width:auto}
  }

  /* Fotoğraflar */
  .foto-yukle{border:2px dashed var(--gray);border-radius:14px;padding:24px;text-align:center;background:#fafafa;transition:.2s}
  .foto-yukle:hover{border-color:var(--primary);background:#fffaf2}
  .foto-yukle input[type=file]{display:none}
  .foto-etiket{display:inline-flex;align-items:center;gap:9px;background:var(--primary);color:#fff;font-weight:800;
               padding:13px 26px;border-radius:13px;cursor:pointer;font-size:.95rem;min-height:48px;transition:.2s}
  .foto-etiket:hover{background:var(--primary-dark)}
  .foto-not{color:var(--muted);font-size:.83rem;margin-top:12px}
  .foto-liste{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:16px}
  .foto-kutu{position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--gray);background:#f1f5f9}
  .foto-kutu img{width:100%;height:120px;object-fit:cover;display:block}
  .foto-arac{display:flex;gap:4px;padding:7px;background:#fff;justify-content:center;flex-wrap:wrap}
  .fa-btn{width:44px;height:44px;border-radius:10px;border:1px solid var(--gray);background:#fff;cursor:pointer;
          font-size:1rem;display:flex;align-items:center;justify-content:center;transition:.15s;color:var(--ink)}
  .fa-btn:hover{border-color:var(--primary);background:#fffaf2}
  .fa-btn.sil:hover{border-color:var(--red);color:var(--red);background:#fef2f2}
  .kapak-rozet{position:absolute;top:8px;left:8px;background:var(--primary);color:#fff;font-size:.66rem;
               font-weight:800;padding:4px 9px;border-radius:20px;letter-spacing:.4px}

  /* Alt kaydet çubuğu */
  .alt-bar{position:fixed;left:0;right:0;bottom:0;z-index:40;background:rgba(255,255,255,.97);
           backdrop-filter:blur(10px);border-top:1px solid var(--gray);
           padding:12px 18px calc(12px + env(safe-area-inset-bottom,0px))}
  .alt-ic{max-width:900px;margin:0 auto;display:flex;gap:10px;align-items:center}
  .btn{border:none;cursor:pointer;font-family:inherit;font-weight:800;font-size:.96rem;border-radius:13px;
       padding:14px 22px;transition:.2s;min-height:50px;display:inline-flex;align-items:center;justify-content:center;gap:8px}
  .btn-ikincil{background:#fff;border:2px solid var(--gray);color:var(--ink);flex-shrink:0}
  .btn-ikincil:hover{border-color:var(--primary);color:var(--primary-dark)}
  .btn-ana{background:var(--primary);color:#fff;flex:1}
  .btn-ana:hover{background:var(--primary-dark)}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .btn:focus-visible,.fa-btn:focus-visible,.foto-etiket:focus-within{outline:3px solid var(--primary);outline-offset:2px}

  /* Bildirim */
  #bildirim{position:fixed;left:50%;transform:translateX(-50%) translateY(-140%);top:calc(76px + env(safe-area-inset-top,0px));
            z-index:60;background:var(--ink);color:#fff;padding:14px 22px;border-radius:13px;font-weight:600;font-size:.93rem;
            max-width:92vw;text-align:center;transition:transform .3s cubic-bezier(.2,.8,.3,1);box-shadow:0 18px 40px -14px rgba(0,0,0,.4)}
  #bildirim.goster{transform:translateX(-50%) translateY(0)}
  #bildirim.hata{background:var(--red)} #bildirim.basari{background:var(--ok)}
  @media (prefers-reduced-motion:reduce){ #bildirim{transition:none} }
</style>
</head>
<body>
<a href="#ana" class="atla">İçeriğe atla</a>

<header class="ust">
  <div class="ic">
    <a class="logo" href="index.html">Civari<span>.</span></a>
    <div class="ust-sag">
      <a class="ust-btn" href="index.html">Siteyi Gör</a>
      <button class="ust-btn" onclick="cikisYap()">Çıkış</button>
    </div>
  </div>
</header>

<main class="sar" id="ana">

  <div class="basl">
    <h1><?= e($isletmeAdi) ?></h1>
    <p>İşletme paneli · <?= e($kullanici['fullname']) ?><?= $kullanici['yetkili_unvan'] ? ' · ' . e($kullanici['yetkili_unvan']) : '' ?></p>
  </div>

  <!-- DURUM KARTI -->
  <?php if ($durum === 'onaylandi'): ?>
    <div class="durum onay" role="status">
      <div class="durum-ust"><span class="durum-rozet">Yayında</span></div>
      <h2>Mekanın Civari'de yayında 🎉</h2>
      <p>Ziyaretçiler mekanını keşfet sayfasında, haritada ve aramalarda görebiliyor. Bilgilerini güncellersen değişiklikler kısa bir incelemeden sonra yayınlanır.</p>
      <a class="link" href="mekan.php?id=<?= (int)$mekan['id'] ?>" target="_blank" rel="noopener">Mekan sayfanı gör ↗</a>
    </div>
  <?php elseif ($durum === 'beklemede'): ?>
    <div class="durum bekle" role="status">
      <div class="durum-ust"><span class="durum-rozet">İnceleniyor</span></div>
      <h2>Başvurun bize ulaştı</h2>
      <p>Ekibimiz mekanının bilgilerini <b>24 saat içinde</b> inceleyip yayınlayacak. Bu süreçte bilgilerini düzenlemeye devam edebilirsin; mekanın onaylanana kadar sitede görünmez.</p>
    </div>
  <?php elseif ($durum === 'reddedildi'): ?>
    <div class="durum red" role="status">
      <div class="durum-ust"><span class="durum-rozet">Düzeltme gerekiyor</span></div>
      <h2>Başvurun için birkaç düzeltme istiyoruz</h2>
      <p><?= $mekan['red_nedeni'] ? e($mekan['red_nedeni']) : 'Bilgilerini gözden geçirip tekrar gönderebilirsin.' ?></p>
    </div>
  <?php elseif ($durum === 'taslak'): ?>
    <div class="durum" role="status">
      <div class="durum-ust"><span class="durum-rozet" style="color:var(--muted)">Taslak</span></div>
      <h2>Bilgilerin kayıtlı, henüz gönderilmedi</h2>
      <p>Hazır olduğunda aşağıdaki <b>Onaya Gönder</b> düğmesine bas. Ekibimiz 24 saat içinde inceleyip mekanını yayınlar.</p>
    </div>
  <?php else: ?>
    <div class="durum" role="status">
      <div class="durum-ust"><span class="durum-rozet" style="color:var(--primary-dark)">Başlayalım</span></div>
      <h2>Mekanını tanıtalım</h2>
      <p>Aşağıdaki bilgileri doldur, haritadan konumunu işaretle ve fotoğraflarını yükle. Hazır olduğunda onaya gönder — 24 saat içinde yayına alıyoruz.</p>
    </div>
  <?php endif; ?>

  <form id="mekanForm" novalidate>
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">

    <!-- 1 — TEMEL BİLGİLER -->
    <section class="kart">
      <div class="kart-basl"><span class="kart-no">1</span><h2>Mekan Bilgileri</h2></div>
      <p class="kart-alt">Ziyaretçilerin ilk gördüğü bilgiler.</p>

      <div class="alan">
        <label for="ad">Mekan adı *</label>
        <input type="text" id="ad" name="name" required maxlength="150"
               value="<?= e($mekan['name'] ?? $kullanici['isletme_adi'] ?? '') ?>" placeholder="Örn. Dharma Coffee">
      </div>

      <div class="ikili">
        <div class="alan">
          <label for="kategori">Kategori *</label>
          <select id="kategori" name="category">
            <?php foreach ($KATEGORILER as $kat): ?>
              <option value="<?= e($kat) ?>" <?= (($mekan['category'] ?? '') === $kat) ? 'selected' : '' ?>><?= e($kat) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="alan">
          <label for="fiyat">Fiyat aralığı</label>
          <select id="fiyat" name="price_level">
            <?php foreach ([1=>'₺ · Uygun', 2=>'₺₺ · Orta', 3=>'₺₺₺ · Yüksek'] as $pl => $pt): ?>
              <option value="<?= $pl ?>" <?= ((int)($mekan['price_level'] ?? 2) === $pl) ? 'selected' : '' ?>><?= e($pt) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>

      <div class="alan">
        <label for="aciklama">Tanıtım yazısı * <span class="ipucu">— mekanını birkaç cümleyle anlat</span></label>
        <textarea id="aciklama" name="description" maxlength="1200" oninput="sayacGuncelle()"
                  placeholder="Mekanını ne özel kılıyor? İmza ürünün, atmosferi, hikâyesi..."><?= e($mekan['description'] ?? '') ?></textarea>
        <div class="sayac"><span id="acikSayac">0</span> / 1200 karakter</div>
      </div>

      <div class="ikili">
        <div class="alan">
          <label for="telefon">Telefon *</label>
          <input type="tel" id="telefon" name="phone" maxlength="30"
                 value="<?= e($mekan['phone'] ?? '') ?>" placeholder="0312 000 00 00">
        </div>
        <div class="alan">
          <label for="web">Web sitesi <span class="ipucu">(isteğe bağlı)</span></label>
          <input type="text" id="web" name="website" maxlength="200"
                 value="<?= e($mekan['website'] ?? '') ?>" placeholder="www.mekanim.com">
        </div>
      </div>

      <div class="alan">
        <label for="etiket">Etiketler <span class="ipucu">(virgülle ayır)</span></label>
        <input type="text" id="etiket" name="tags" maxlength="200"
               value="<?= e($mekan['tags'] ?? '') ?>" placeholder="kahve, çalışma, kahvaltı">
      </div>

      <label class="kutu-satir">
        <input type="checkbox" name="alcohol" value="1" <?= !empty($mekan['alcohol']) ? 'checked' : '' ?>>
        <span>Alkollü içecek servisi var</span>
      </label>
    </section>

    <!-- 2 — KONUM -->
    <section class="kart">
      <div class="kart-basl"><span class="kart-no">2</span><h2>Konum</h2></div>
      <p class="kart-alt">Adresini yaz, sonra haritadaki turuncu pini tam kapının önüne sürükle.</p>

      <div class="alan">
        <label for="adres">Açık adres *</label>
        <div class="adres-ara">
          <input type="text" id="adres" name="address" maxlength="255"
                 value="<?= e($mekan['address'] ?? '') ?>" placeholder="Cadde, sokak, kapı no">
          <button type="button" class="btn-ara" onclick="adresAra()">Haritada bul</button>
        </div>
      </div>

      <div class="alan">
        <label for="ilce">Semt / İlçe</label>
        <input type="text" id="ilce" name="district" maxlength="80"
               value="<?= e($mekan['district'] ?? 'Çankaya') ?>" placeholder="Örn. Çankaya">
      </div>

      <div id="harita" role="application" aria-label="Mekan konumu seçme haritası"></div>
      <p class="konum-bilgi" id="konumBilgi" role="status">Konum seçilmedi</p>
      <input type="hidden" id="lat" name="lat" value="<?= e($mekan['lat'] ?? '') ?>">
      <input type="hidden" id="lng" name="lng" value="<?= e($mekan['lng'] ?? '') ?>">
    </section>

    <!-- 3 — ÇALIŞMA SAATLERİ -->
    <section class="kart">
      <div class="kart-basl"><span class="kart-no">3</span><h2>Çalışma Saatleri</h2></div>
      <p class="kart-alt">Ziyaretçiler mekanının o an açık olup olmadığını görür.</p>
      <div id="saatler">
        <?php foreach ($GUNLER as $kod => $gunAdi): ?>
          <div class="saat-satir" data-gun="<?= e($kod) ?>">
            <span class="gun"><?= e($gunAdi) ?></span>
            <div class="saat-kutular">
              <input type="text" class="acilis" inputmode="numeric" placeholder="09:00" maxlength="5"
                     aria-label="<?= e($gunAdi) ?> açılış saati">
              <span aria-hidden="true">–</span>
              <input type="text" class="kapanis" inputmode="numeric" placeholder="23:00" maxlength="5"
                     aria-label="<?= e($gunAdi) ?> kapanış saati">
            </div>
            <label class="kapali-etiket">
              <input type="checkbox" class="kapali" aria-label="<?= e($gunAdi) ?> kapalı">
              <span>Kapalı</span>
            </label>
          </div>
        <?php endforeach; ?>
      </div>
      <input type="hidden" id="saatMetin" name="opening_hours" value="<?= e($mekan['opening_hours'] ?? '') ?>">
    </section>
  </form>

  <!-- 4 — FOTOĞRAFLAR -->
  <section class="kart">
    <div class="kart-basl"><span class="kart-no">4</span><h2>Fotoğraflar</h2></div>
    <p class="kart-alt">İlk fotoğraf kapak olur. Sıralamayı ok düğmeleriyle değiştirebilirsin.</p>

    <?php if (!$mekan): ?>
      <div class="foto-yukle" style="opacity:.6">
        <p style="color:var(--muted);font-size:.93rem">Fotoğraf ekleyebilmek için önce mekan bilgilerini kaydet.</p>
      </div>
    <?php else: ?>
      <div class="foto-yukle">
        <label class="foto-etiket" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}">
          Fotoğraf Seç
          <input type="file" id="fotoGirdi" accept="image/jpeg,image/png,image/webp" multiple onchange="fotoYukle(this)">
        </label>
        <p class="foto-not">Birden fazla seçebilirsin · JPG, PNG veya WEBP · en fazla 10 MB</p>
      </div>

      <div class="foto-liste" id="fotoListe">
        <?php foreach ($fotolar as $ft): $kapakMi = trim((string)$mekan['image_url']) === $ft['url']; ?>
          <div class="foto-kutu">
            <?php if ($kapakMi): ?><span class="kapak-rozet">KAPAK</span><?php endif; ?>
            <img src="<?= e($ft['url']) ?>" alt="Mekan fotoğrafı" loading="lazy">
            <div class="foto-arac">
              <button type="button" class="fa-btn" onclick="fotoIslem('foto_sirala',<?= (int)$ft['id'] ?>,'yukari')" title="Öne al" aria-label="Fotoğrafı öne al">↑</button>
              <button type="button" class="fa-btn" onclick="fotoIslem('foto_sirala',<?= (int)$ft['id'] ?>,'asagi')" title="Geri al" aria-label="Fotoğrafı geri al">↓</button>
              <?php if (!$kapakMi): ?>
                <button type="button" class="fa-btn" onclick="fotoIslem('foto_kapak',<?= (int)$ft['id'] ?>)" title="Kapak yap" aria-label="Kapak fotoğrafı yap">★</button>
              <?php endif; ?>
              <button type="button" class="fa-btn sil" onclick="fotoSil(<?= (int)$ft['id'] ?>)" title="Sil" aria-label="Fotoğrafı sil">✕</button>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
      <?php if (!$fotolar): ?>
        <p style="color:var(--muted);font-size:.9rem;text-align:center;margin-top:14px">Henüz fotoğraf yok. En az 1 fotoğraf gerekiyor.</p>
      <?php endif; ?>
    <?php endif; ?>
  </section>

  <p style="color:var(--muted);font-size:.83rem;text-align:center;margin:22px 0 8px;line-height:1.6">
    Yalnızca kendi çektiğin ya da kullanma hakkına sahip olduğun fotoğrafları yükle.<br>
    Sorun yaşarsan: <a href="mailto:mail@example.com">mail@example.com</a>
  </p>
</main>

<div class="alt-bar">
  <div class="alt-ic">
    <button type="button" class="btn btn-ikincil" onclick="kaydet('kaydet')">Kaydet</button>
    <button type="button" class="btn btn-ana" onclick="kaydet('onaya_gonder')">
      <?= $durum === 'onaylandi' ? 'Değişiklikleri Gönder' : 'Onaya Gönder' ?>
    </button>
  </div>
</div>

<div id="bildirim" role="status" aria-live="polite"></div>

<script src="vendor/leaflet.js"></script>
<script>
const CSRF = <?= json_encode($csrf) ?>;
const GUN_KODLARI = <?= json_encode(array_keys($GUNLER)) ?>;

/* ---------- Bildirim ---------- */
let bildirimZaman = null;
function bildir(mesaj, tur){
  const el = document.getElementById('bildirim');
  el.textContent = mesaj;
  el.className = 'goster ' + (tur || '');
  clearTimeout(bildirimZaman);
  bildirimZaman = setTimeout(()=>{ el.className = tur || ''; }, 4200);
}

/* ---------- Karakter sayacı ---------- */
function sayacGuncelle(){
  document.getElementById('acikSayac').textContent = document.getElementById('aciklama').value.length;
}

/* ---------- HARİTA ---------- */
const ANKARA = [39.9208, 32.8541];
let harita, pin;
(function haritaKur(){
  const lat = parseFloat(document.getElementById('lat').value);
  const lng = parseFloat(document.getElementById('lng').value);
  const varMi = !isNaN(lat) && !isNaN(lng) && lat && lng;
  const merkez = varMi ? [lat, lng] : ANKARA;

  harita = L.map('harita', { scrollWheelZoom:false }).setView(merkez, varMi ? 17 : 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution:'&copy; OpenStreetMap katkıcıları', maxZoom:19 }).addTo(harita);

  const ikon = L.divIcon({
    html:'<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#ff9900;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35)"></div>',
    className:'', iconSize:[26,26], iconAnchor:[13,26]
  });
  pin = L.marker(merkez, { icon:ikon, draggable:true, keyboard:true, title:'Mekan konumu — sürükleyerek taşı' }).addTo(harita);
  pin.on('dragend', ()=>konumYaz(pin.getLatLng()));
  harita.on('click', (ev)=>{ pin.setLatLng(ev.latlng); konumYaz(ev.latlng); });

  if (varMi) konumYaz({ lat, lng });
})();

function konumYaz(k){
  document.getElementById('lat').value = k.lat.toFixed(7);
  document.getElementById('lng').value = k.lng.toFixed(7);
  const ankarada = k.lat>=39.60 && k.lat<=40.20 && k.lng>=32.30 && k.lng<=33.30;
  document.getElementById('konumBilgi').innerHTML = ankarada
    ? '<b>✓ Konum seçildi</b> · ' + k.lat.toFixed(5) + ', ' + k.lng.toFixed(5)
    : '⚠️ Bu nokta Ankara dışında görünüyor. Pini Ankara içine taşı.';
}

/* Adresten konum bulma (OpenStreetMap Nominatim) */
async function adresAra(){
  const adres = document.getElementById('adres').value.trim();
  if (!adres) { bildir('Önce adresi yaz.', 'hata'); return; }
  const sorgu = adres + ', ' + (document.getElementById('ilce').value.trim() || 'Çankaya') + ', Ankara, Türkiye';
  bildir('Adres aranıyor...');
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=' + encodeURIComponent(sorgu), { headers:{'Accept':'application/json'} });
    const veri = await res.json();
    if (!veri || !veri.length) { bildir('Adres bulunamadı. Pini elle sürükleyebilirsin.', 'hata'); return; }
    const k = { lat: parseFloat(veri[0].lat), lng: parseFloat(veri[0].lon) };
    harita.setView([k.lat, k.lng], 17);
    pin.setLatLng([k.lat, k.lng]);
    konumYaz(k);
    bildir('Adres bulundu. Pini tam kapının önüne sürükleyebilirsin.', 'basari');
  } catch(e){ bildir('Adres araması yapılamadı. Pini elle sürükle.', 'hata'); }
}

/* ---------- ÇALIŞMA SAATLERİ ---------- */
function saatleriMetneCevir(){
  const parcalar = [];
  document.querySelectorAll('.saat-satir').forEach(satir=>{
    const kod = satir.dataset.gun;
    if (satir.querySelector('.kapali').checked) { parcalar.push(kod + ' off'); return; }
    const a = satir.querySelector('.acilis').value.trim();
    const k = satir.querySelector('.kapanis').value.trim();
    if (/^\d{1,2}:\d{2}$/.test(a) && /^\d{1,2}:\d{2}$/.test(k)) parcalar.push(kod + ' ' + a + '-' + k);
  });
  return parcalar.join('; ');
}
function saatleriYukle(metin){
  if (!metin) return;
  metin.split(';').forEach(parca=>{
    parca = parca.trim(); if (!parca) return;
    const es = parca.match(/^([A-Za-z,\-]+)\s+(.+)$/); if (!es) return;
    const gunler = [];
    es[1].split(',').forEach(seg=>{
      seg = seg.trim();
      if (seg.indexOf('-') !== -1){
        const [b, s] = seg.split('-');
        let i = GUN_KODLARI.indexOf(b);
        const son = GUN_KODLARI.indexOf(s);
        if (i === -1 || son === -1) return;
        for (let n = 0; n < 7; n++){ gunler.push(GUN_KODLARI[i]); if (i === son) break; i = (i + 1) % 7; }
      } else gunler.push(seg);
    });
    const zaman = es[2].trim();
    gunler.forEach(kod=>{
      const satir = document.querySelector('.saat-satir[data-gun="' + kod + '"]'); if (!satir) return;
      if (/off|closed/i.test(zaman)) { satir.querySelector('.kapali').checked = true; return; }
      const ar = zaman.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (ar){ satir.querySelector('.acilis').value = ar[1]; satir.querySelector('.kapanis').value = ar[2]; }
    });
  });
}
/* Kapalı işaretlenince saat kutuları pasifleşsin */
document.querySelectorAll('.saat-satir .kapali').forEach(kutu=>{
  kutu.addEventListener('change', ()=>{
    const satir = kutu.closest('.saat-satir');
    satir.querySelectorAll('.acilis,.kapanis').forEach(g=>{ g.disabled = kutu.checked; if (kutu.checked) g.value = ''; });
  });
});

/* ---------- KAYDET ---------- */
async function kaydet(eylem){
  const form = document.getElementById('mekanForm');
  document.getElementById('saatMetin').value = saatleriMetneCevir();

  const fd = new FormData(form);
  fd.append('action', eylem);
  fd.set('csrf', CSRF);

  document.querySelectorAll('.alt-bar .btn').forEach(b=>b.disabled = true);
  bildir(eylem === 'onaya_gonder' ? 'Başvurun gönderiliyor...' : 'Kaydediliyor...');
  try {
    const res = await fetch('isletme_api.php', { method:'POST', body:fd });
    const r = await res.json();
    if (r.status === 'success'){
      bildir(r.message, 'basari');
      setTimeout(()=>location.reload(), 1400);
      return;
    }
    bildir(r.message || 'Kaydedilemedi.', 'hata');
  } catch(e){ bildir('Sunucuya ulaşılamadı.', 'hata'); }
  document.querySelectorAll('.alt-bar .btn').forEach(b=>b.disabled = false);
}

/* ---------- FOTOĞRAF ---------- */
async function fotoYukle(girdi){
  if (!girdi.files || !girdi.files.length) return;
  const fd = new FormData();
  fd.append('action','foto_yukle'); fd.append('csrf', CSRF);
  for (const dosya of girdi.files) fd.append('fotolar[]', dosya);
  bildir(girdi.files.length + ' fotoğraf yükleniyor...');
  try {
    const res = await fetch('isletme_api.php', { method:'POST', body:fd });
    const r = await res.json();
    bildir(r.message, r.status === 'success' ? 'basari' : 'hata');
    if (r.status === 'success') setTimeout(()=>location.reload(), 1200);
  } catch(e){ bildir('Yükleme yapılamadı.', 'hata'); }
  girdi.value = '';
}
async function fotoIslem(eylem, id, yon){
  const fd = new FormData();
  fd.append('action', eylem); fd.append('csrf', CSRF); fd.append('foto_id', id);
  if (yon) fd.append('yon', yon);
  try {
    const res = await fetch('isletme_api.php', { method:'POST', body:fd });
    const r = await res.json();
    if (r.status === 'success') location.reload(); else bildir(r.message, 'hata');
  } catch(e){ bildir('İşlem yapılamadı.', 'hata'); }
}
function fotoSil(id){
  if (!confirm('Bu fotoğraf silinsin mi?')) return;
  fotoIslem('foto_sil', id);
}

/* ---------- ÇIKIŞ ---------- */
async function cikisYap(){
  try { const fd = new FormData(); fd.append('action','logout'); await fetch('auth.php', { method:'POST', body:fd }); } catch(e){}
  location.href = 'index.html';
}

/* ---------- BAŞLAT ---------- */
saatleriYukle(document.getElementById('saatMetin').value);
document.querySelectorAll('.saat-satir .kapali').forEach(k=>{ if (k.checked) k.dispatchEvent(new Event('change')); });
sayacGuncelle();
</script>
</body>
</html>
