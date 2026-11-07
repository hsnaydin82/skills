# Rehber şeması

## Rehber

```json
{
  "baslik": "Yeni görev ekleme",
  "ozet": "Giriş kartında görünen tek cümle.",
  "adimlar": [
    {
      "baslik": "Görevi doldurun",
      "metin": "Altyazıda ve yazılı adımda görünen açıklama.",
      "url": "/gorevler/yeni",
      "sonuc": "Görev kaydedildi.",
      "eylemler": [
        { "tur": "yaz", "hedef": "[name=baslik]", "deger": "Haftalık rapor", "not": "Kısa bir başlık" }
      ]
    }
  ]
}
```

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `baslik` | Evet | Rehberin veya adımın başlığı |
| `ozet` | Hayır | Giriş kartındaki kısa açıklama |
| `adimlar[].metin` | Evet | Altyazı metni. Adımın süresi metnin uzunluğuna göre belirlenir: en az `3400 ms + 34 ms × karakter` |
| `adimlar[].url` | İlk adımda evet | Açılacak aynı site adresi. Boşsa önceki ekranda devam edilir. `#yok:kayıt adı` değeri kayıt olmadığını bildirir |
| `adimlar[].sonuc` | Hayır | Adım sonunda sağ üstte görünen başarı bildirimi. İşlem yapmaz |
| `eylemler[].not` | Hayır | Öğenin yanında açılan kısa balon |

## Eylemler

| `tur` | Ne yapar | Gerçekten tıklar mı? | Ne zaman |
|---|---|---|---|
| `goster` | Öğeyi vurgular, imleci götürür, `not` gösterir | Hayır | Bölgeyi veya salt okunur bilgiyi tanıtmak |
| `yaz` | `deger` metnini harf harf yazar; `input` ve `change` olayı gönderir | Hayır | Metin alanları. Tarih alanına değer doğrudan yazılır |
| `sec` | Seçenekleri sahnede gösterir, metni `deger` içereni seçer. `deger` yoksa ilk dolu seçeneği alır; alan doluysa değiştirmez | Hayır | Yerel `<select>` |
| `isaret` | Onay kutusunu veya radyo düğmesini işaretler | Hayır | `checkbox`, `radio` |
| `tikla` | Basış animasyonu gösterir | **Hayır** | Kaydet, gönder, sil gibi kalıcı işlem düğmeleri |
| `ac` | Öğeye gerçekten tıklar | **Evet** | Pencere veya sekme açan düğmeler |
| `calistir` | Öğeye gerçekten tıklar | **Evet** | Kayıt yapmayan ekran düğmeleri (hesapla, filtrele) |
| `git` | Basışı gösterir, `href` adresine geçer | Adres açılır | Başka ekrana götüren aynı site bağlantıları |

## Hedef söz dizimi

| Biçim | Örnek | Anlamı |
|---|---|---|
| CSS seçici | `[name=baslik]` | Eşleşen ilk görünür öğe |
| `seçici\|metin` | `button\|Filtrele` | Metni içeren ilk öğe; büyük-küçük harfe bakmaz |
| `kart:Başlık` | `kart:Görev Bilgileri` | Başlığı bu metni içeren kart |
| `A >> B` | `kart:Adres >> input` | A'nın içindeki B; biçimler birleştirilebilir |

Gizli giriş kutusu hedeflenirse (`.btn-check` gibi) etiketi `label[for]` vurgulanır.

## HTML öznitelikleri

| Yer | Öznitelik | Açıklama |
|---|---|---|
| Oynatıcı | `data-anlatim` | Oynatıcıyı başlatır; içinde `<script type="application/json">` bulunur |
| Oynatıcı | `data-modul` | Giriş kartındaki üst etiket |
| Oynatıcı | `data-ikon` | Giriş kartında tek karakter veya emoji |
| Yazılı adım | `data-adim="0"` | Oynarken vurgulanır; `.yd-rehber` içinde olmalıdır |
| Yazılı adım | `data-adim-izle="0"` | Oynatıcıyı bu adımdan başlatan düğme |
| Açılan sayfa | `data-anlatim-engel="Metin"` | Sayfanın yetkisiz olduğunu bildirir; metin kullanıcıya gösterilir |

## `window.AnlatimAyar`

`anlatim.js` dosyasından önce tanımlanır. Hepsi isteğe bağlıdır.

| Ayar | Varsayılan | Açıklama |
|---|---|---|
| `sayfaSecici` | `null` | Açılan sayfada bulunması gereken öğe. Yoksa oturum düşmüş sayılır. Her projede ver |
| `engelSecici` | `[data-anlatim-engel]` | Yetkisiz sayfanın işareti |
| `kartSecici` | `.card` | `kart:` hedefinin kapsayıcısı |
| `kartBaslikSecici` | `.card-title, .card-header` | Kartın başlığı |
| `yazmaEngeli` | `true` | iframe'den çıkan GET/HEAD dışı istekleri engeller |
| `izinliYazmaAdresleri` | `[]` | Engellenmeyen yol önekleri, ör. `['/api/sorgula']` |
| `hedefBekleme` | `2500` | Öğe çizilene kadar en fazla bekleme (ms) |
| `modalKapat` | `null` | `function (w, doc)`; pencere kapatıldıysa `true` döner. Yoksa varsa Bootstrap kullanılır |
| `metinler` | `null` | Arayüz metinleri. Anahtarlar `anlatim.js` içindeki `METIN_TR` nesnesindedir |

## Stil değişkenleri

```css
:root {
  --yd-ana: #2563EB;        /* Vurgu rengi */
  --yd-ana-rgb: 37,99,235;  /* Aynı rengin RGB değerleri */
  --yd-ana-uzeri: #fff;     /* Vurgu rengi üzerindeki yazı */
}
```

## Kontroller

Oynat/duraklat, önceki ve sonraki adım, adım çubuğu, baştan oynat ve tam ekran hazırdır. Oynatıcı odaktayken `Boşluk` veya `K` oynatır, `←` ve `→` adım değiştirir. Ekrandan çıkan anlatım duraklar. Aynı anda tek anlatım oynar. `prefers-reduced-motion` tercihinde kamera ve yazma animasyonları sadeleşir.
