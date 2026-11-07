---
name: gercek-ekran-anlatimi
description: Bir web uygulamasına, kullanıcının kendi gerçek ekranında oynayan video tarzı animasyonlu anlatımlar ekler. Kamera öğeye yaklaşır, imleç hareket eder, alanlara yazı yazılır, altyazı ve adım çubuğu görünür; video kaydı gerekmez ve veri kaydedilmez. "Yardım sayfasına animasyonlu anlatım", "video tarzı kullanım rehberi", "ürün turu", "gerçek ekranda gösterim" istendiğinde kullan. Also use for an "in-app walkthrough", "interactive product demo", "guided tour on the real UI" or "animated help page".
metadata:
  author: hsnaydin82
  website: https://www.mesaydijital.com
---

# Gerçek Ekran Anlatımı

Yardım sayfasına, video gibi izlenen ama video olmayan anlatımlar ekler. Oynatıcı uygulamanın gerçek sayfasını aynı sitede bir iframe'de açar ve JSON rehberindeki adımları o sayfanın öğeleri üzerinde canlandırır. Ekran değişince rehberin yeniden kaydedilmesi gerekmez, yalnızca değişen seçici güncellenir.

Hazır parçalar bu skill'in `assets/` klasöründedir. Motoru yeniden yazma; kopyala, ayarla ve rehberleri yaz.

## Uygun olmayan durumlar

Aşağıdaki durumlarda devam etmeden kullanıcıya söyle:

- Gösterilecek ekran başka bir alan adındaysa. Oynatıcı iframe'in içine yalnızca aynı siteden erişebilir.
- Uygulama kendisini iframe'de açtırmıyorsa ve bu ayar değiştirilemiyorsa.
- İstenen şey sosyal medya için bir video dosyasıysa. Bu skill dosya üretmez, uygulamanın içinde oynar.

## Akış

### 1. Uygulamayı tanı

Kod yazmadan önce şunları kodda doğrula:

- **Yardım sayfası:** Var mı, yoksa nereye eklenecek? Oturum açmış kullanıcı için mi?
- **Çerçeve izni:** `X-Frame-Options` `DENY` ise veya CSP `frame-ancestors` aynı siteye izin vermiyorsa anlatım açılmaz. `SAMEORIGIN` ya da `frame-ancestors 'self'` gerekir. Bu bir güvenlik ayarıdır; değiştirmeden önce kullanıcıya sor.
- **Yan etkiler:** Sayfalar GET ile veri değiştiriyor mu (ör. okundu işareti)? Alanlar değişince otomatik kaydediyor mu? Kaydediliyorsa yazma engelinin bunu kapsadığını doğrula.
- **Kart yapısı:** `kart:` hedefi için kart ve başlık sınıfları neler?
- **Giriş ve yetki:** Oturum düşünce veya yetki yokken sayfa ne gösteriyor?

### 2. Dosyaları yerleştir

`assets/anlatim.js` ve `assets/anlatim.css` dosyalarını projenin statik klasörüne kopyala. Harici bağımlılıkları yoktur. Açık Bootstrap pencereleri iframe'de `window.bootstrap` varsa onunla kapatılır; Bootstrap zorunlu değildir.

Yardım sayfasına şu yapıyı ekle. Eksiksiz, çalışan örnek: `examples/demo/index.html`.

```html
<link rel="stylesheet" href="/static/anlatim.css">

<section class="yd-rehber" id="rehber-kodu">
  <div class="yd-oynatici" data-anlatim data-modul="Modül adı">
    <script type="application/json">{ "baslik": "...", "ozet": "...", "adimlar": [] }</script>
  </div>
  <ol class="yd-adimlar"><!-- Yazılı adımlar; her li data-adim="0" taşır --></ol>
</section>

<script>window.AnlatimAyar = { sayfaSecici: '[data-uygulama]' };</script>
<script src="/static/anlatim.js"></script>
```

Arayüz metinleri `<html lang>` değerine göre Türkçe veya İngilizce olur. Başka diller için `AnlatimAyar.metinler` kullan. Renkleri `--yd-ana`, `--yd-ana-rgb` ve `--yd-ana-uzeri` ile markaya uydur.

`sayfaSecici` değerini mutlaka ver. Uygulama düzeninde bulunan, giriş sayfasında bulunmayan bir öğe seç; böylece oturum düşünce anlatım giriş ekranının üzerinde oynamaz. Yetkisiz sayfaya `data-anlatim-engel="Kullanıcıya gösterilecek metin"` ekle.

### 3. Rehberleri yaz

Alan adları, eylem türleri, hedef söz dizimi ve tüm ayarlar `references/rehber-semasi.md` dosyasındadır. Rehber yazmadan önce bu dosyayı oku.

- **Önce ekranı oku:** Seçicileri tahmin etme. Her hedefi ekranın gerçek şablonundan al.
- **Dayanıklı seçici kullan:** Sırayla `[name=...]`, `[data-*]`, kararlı kimlik ve `kart:Başlık`. `nth-child` ve görsel sınıflardan kaçın.
- **Kaydeden düğmede `tikla` kullan:** `tikla` gerçekten tıklamaz, yalnızca basışı gösterir. `calistir` ve `ac` gerçekten tıklar; bunları yalnızca sunucuda kayıt yapmayan düğmelerde kullan.
- **Metni ayır:** `metin` adımın yazılı anlatımıdır ve altyazıda görünür. `not` öğenin yanındaki birkaç kelimelik balondur. `sonuc`, başarı bildirimidir ve yalnızca gösterim amaçlıdır.
- **Adım sayısını kısa tut:** Rehber başına 3-6 adım, adım başına 1-5 eylem. Uzun süreçleri ayrı rehberlere böl.
- **Örnek değerleri açıkça örnek yaz:** Gerçek kişi, telefon veya e-posta kullanma.
- **Yazılı adımları da üret:** Her adım `<ol class="yd-adimlar">` içinde metin olarak bulunsun. JavaScript çalışmadığında veya ekran açılamadığında kullanıcı bunları okur; ekran okuyucular için de gereklidir.

### 4. Kayda bağlı ekranları sunucuda doldur

Düzenleme ve detay ekranları için gerçek bir kayıt adresi gerekir. Rehberde `/kayitlar/{kayit}` gibi yer tutucu kullan, sunucu sayfayı üretirken doldursun:

- Kaydı oturumdaki kullanıcının erişebildiği kayıtlar arasından seç. Çok kiracılı sistemde kiracı filtresini atlama.
- Kayıt yoksa adres olarak `#yok:müşteri` yaz; oynatıcı önce o kaydın oluşturulması gerektiğini söyler.
- Tarih gibi değerleri de aynı yöntemle doldur, böylece form bugünün tarihiyle görünür.

### 5. Güvenliği koru

- **Rehberi kullanıcı girdisinden üretme.** Rehberleri kod deposu gibi güvenilir bir kaynakta tut. Rehber, hangi düğmeye basılacağını ve hangi adresin açılacağını belirler; kullanıcı düzenleyebilirse bu yetkiyi kötüye kullanabilir.
- **JSON'u `<script>` için güvenli yaz.** Sunucuda üretiyorsan `<`, `>` ve `&` karakterlerini `\u` ile kaçır; aksi halde `</script>` içeren bir metin sayfayı kırar.
- **Sandbox'ı güvenlik sınırı sayma.** `allow-same-origin` ile `allow-scripts` birlikte verildiği için iframe aynı sitenin kodunu tam yetkiyle çalıştırır. Sandbox form gönderimini, açılır pencereleri ve üst sayfaya yönlendirmeyi kazalara karşı kapatır; `allow-forms` ekleme.
- **Yazma engelinin sınırını bil.** `fetch`, `XMLHttpRequest` ve `sendBeacon` ile çıkan GET/HEAD dışı istekler sayfa yüklendikten sonra engellenir. Sayfanın yüklenirken gönderdiği istekleri ve GET ile veri değiştiren uçları kapsamaz. Bunları 1. adımda bul.
- **İzin listesini dar tut.** `izinliYazmaAdresleri` yalnızca kayıt yapmayan POST uçlarını içersin.

### 6. Tarayıcıda doğrula

Rehberi yazdıktan sonra çalıştığını söylemeden önce gerçek tarayıcıda oynat:

1. Her rehberi baştan sona oynat. `window.YardimAnlatim.oynaticilar[i].durum` değeri `bitti` olmalı.
2. Konsolda `[anlatim] hedef bulunamadi` uyarısı kalmamalı. Her uyarı bozuk bir seçici ya da eksik örnek veridir.
3. Oynatmadan önceki ve sonraki veriyi karşılaştır; hiçbir kayıt değişmemeli. Ağ kayıtlarında GET dışı istek olmamalı.
4. Ortadan bir adımı `data-adim-izle` ile başlat; önceki adımların hazırladığı ekran doğru gelmeli.
5. 400 piksel genişlikte dene; oynatıcı dar görünüme geçmeli.
6. Giriş yapmadan, yetkisiz kullanıcıyla ve hiç kaydı olmayan hesapla açılışı dene; anlaşılır bir uyarı görünmeli.

Ekran görüntüsü alabiliyorsan birkaç adımın görüntüsüne bak. Balonun öğeyi kapatmadığını ve yazıların taşmadığını kontrol et.

### 7. Bakımı unutma

Ekrandaki alan değişirse rehberin seçicisi de değişmelidir. Rehberlerin yanına bunu belirten bir açıklama yaz. Projede tarayıcı testi varsa konsol uyarısını denetleyen bir test ekle.

## Sınırlar

- Yalnızca aynı siteden sayfalar açılır; shadow DOM içindeki öğeler hedeflenemez.
- Yerel `<select>` programla açılamaz. Oynatıcı seçenekleri kendi katmanında gösterir ve seçimi gerçek listeye uygular. Özel açılır liste bileşenlerinde `calistir` ile açıp `tikla` veya `goster` kullan.
- SPA'larda `url` tam sayfa yükler. Sonradan çizilen öğeler `hedefBekleme` süresi kadar beklenir.
- Dosya seçme penceresi gibi tarayıcı pencereleri canlandırılamaz; alanı `goster` ile tarif et.
