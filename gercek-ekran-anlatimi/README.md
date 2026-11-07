# Gerçek Ekran Anlatımı

**Author:** [hsnaydin82](https://github.com/hsnaydin82) · [www.mesaydijital.com](https://www.mesaydijital.com)

Web uygulamanıza video gibi izlenen, ama video olmayan kullanım anlatımları ekleyen bir [Claude Code](https://claude.com/claude-code) skill'i.

Oynatıcı, uygulamanızın gerçek sayfasını açar ve adımları o sayfanın üzerinde canlandırır: kamera öğeye yaklaşır, imleç hareket eder, alanlara yazı yazılır, altyazı ve adım çubuğu görünür. Kullanıcı anlatımı kendi ekranında ve kendi verisiyle izler.

- **Video kaydı yok:** Ekran değişince video yeniden çekilmez, yalnızca değişen seçici güncellenir.
- **Veri değişmez:** Kaydet düğmeleri gerçekten tıklanmaz, form gönderimi kapalıdır ve GET/HEAD dışı istekler engellenir.
- **Bağımlılık yok:** Tek JavaScript ve tek CSS dosyasıdır. Herhangi bir sunucu dili veya çatıyla çalışır.
- **Video gibi kontroller:** Oynat/duraklat, adım çubuğu, adımlar arasında geçiş, tam ekran, klavye kısayolları ve telefon görünümü.
- **Türkçe ve İngilizce arayüz:** Dil `<html lang>` değerinden seçilir, başka diller eklenebilir.

## Kurulum

Depoyu indirin ve skill klasörünü skill dizininize kopyalayın:

```bash
git clone https://github.com/hsnaydin82/skills.git

# Tüm projeleriniz için
mkdir -p ~/.claude/skills
cp -r skills/gercek-ekran-anlatimi ~/.claude/skills/

# Yalnızca bir proje için (depoyu indirdiğiniz klasörde çalıştırın)
mkdir -p /proje/yolu/.claude/skills
cp -r skills/gercek-ekran-anlatimi /proje/yolu/.claude/skills/
```

Ardından Claude Code'a isteğinizi yazın ya da `/gercek-ekran-anlatimi` komutunu kullanın.

## Örnek promptlar

**Tek ekran için başlangıç:**

```text
/gercek-ekran-anlatimi
Yardım sayfamıza "Yeni müşteri ekleme" anlatımı ekle.
Ekran /musteriler/yeni adresinde. Ad, telefon ve e-posta alanlarını örnek değerlerle doldursun,
sonra Kaydet düğmesine basışı göstersin ama kayıt yapmasın.
Bittiğinde tarayıcıda baştan sona oynatıp konsolda uyarı kalmadığını doğrula.
```

**Bütün bir yardım merkezi:**

```text
/gercek-ekran-anlatimi
Uygulamada henüz yardım sayfası yok. Oturum açmış kullanıcılar için /yardim sayfası oluştur.
Önce menüdeki modülleri incele ve her biri için hangi anlatımları önerdiğini bana listele;
ben onayladıktan sonra yaz.

- Her rehber 3-6 adım olsun, alt alta yazılı adımlar da görünsün.
- Detay ekranları için kullanıcının kendi kayıtlarından birini sunucuda seç. Kaydı yoksa
  önce kayıt oluşturması gerektiğini söylesin.
- Kullanıcının yetkisi olmayan ekranlarda anlaşılır bir uyarı göstersin.
- Renkleri mevcut temaya uydur.
- Sayfalarda otomatik kaydeden alan veya GET ile veri değiştiren uç varsa önce bana bildir.
```

**Mevcut rehberin bakımı:**

```text
/gercek-ekran-anlatimi
Fatura ekranındaki alanları değiştirdik. Bu ekrana bağlı anlatımları tarayıcıda oynat,
"hedef bulunamadi" uyarısı veren seçicileri bul ve yeni alanlara göre düzelt.
```

**İngilizce uygulama:**

```text
/gercek-ekran-anlatimi
Add an in-app walkthrough to our Help page for creating an invoice at /invoices/new.
Fill the fields with obviously fake sample data and show the Save click without submitting.
Use English UI text and our brand color, then play it in a browser and confirm that
no console warnings remain and no write requests are sent.
```

## Demoyu çalıştırma

Oynatıcı iframe'in içine eriştiği için sayfa `file://` ile değil, bir sunucudan açılmalıdır:

```bash
cd skills/gercek-ekran-anlatimi
python -m http.server 8000
```

Ardından tarayıcıda `http://localhost:8000/examples/demo/` adresini açın.

## Klasör yapısı

```text
gercek-ekran-anlatimi/
├── SKILL.md                    Claude'un izlediği yönergeler
├── assets/
│   ├── anlatim.js              Oynatıcı
│   └── anlatim.css             Oynatıcı stilleri
├── references/
│   └── rehber-semasi.md        Rehber alanları, eylemler ve ayarlar
└── examples/demo/              Çalışan örnek
```

## Sınırlar

- Gösterilen ekran, yardım sayfasıyla aynı sitede olmalıdır ve aynı sitenin iframe'inde açılmaya izin vermelidir (`X-Frame-Options: SAMEORIGIN` veya `frame-ancestors 'self'`).
- Yazma engeli, sayfa yüklendikten sonra çıkan istekleri kapsar. Sayfanın yüklenirken gönderdiği istekler ve GET ile veri değiştiren uçlar uygulama tarafında kontrol edilmelidir.
- Shadow DOM içindeki öğeler hedeflenemez.
