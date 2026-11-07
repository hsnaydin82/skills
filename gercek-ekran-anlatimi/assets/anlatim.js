/*
 * Gerçek ekran üzerinde animasyonlu anlatım oynatıcısı. Bağımlılığı yoktur.
 *
 * Her rehber JSON olarak gelir. Oynatıcı uygulamanın gerçek sayfasını korumalı bir iframe'de açar
 * (sandbox: form gönderimi, açılır pencere ve üst sayfaya yönlendirme kapalı; iframe tıklanamaz) ve adımları o sayfanın
 * gerçek öğeleri üzerinde canlandırır: kamera öğeye yaklaşır, öğe vurgulanır, imleç gider, yazı yazılır, seçim yapılır,
 * düğmeye basılışı gösterilir. "tikla" eylemi gerçekten tıklamaz.
 *
 * Hedef söz dizimi: CSS seçici | "seçici|metin" (metni içeren ilk öğe) | "kart:Başlık" (başlığı bu olan kart) | "A >> B" (A'nın içinde B)
 * Ayarlar için bu dosyadan önce window.AnlatimAyar tanımlanabilir (bkz. references/rehber-semasi.md).
 */
(function () {
    'use strict';

    var IPTAL = { iptal: true };

    var AYAR = Object.assign({
        kartSecici: '.card',                // "kart:Başlık" hedefinin aradığı kapsayıcı
        kartBaslikSecici: '.card-title, .card-header',
        sayfaSecici: null,                  // Açılan sayfada bulunması gereken öğe; yoksa giriş sayfasına düşülmüş sayılır
        engelSecici: '[data-anlatim-engel]', // Yetkisiz sayfanın işareti; özniteliğindeki metin kullanıcıya gösterilir
        yazmaEngeli: true,                  // iframe'den çıkan GET/HEAD dışı istekleri engeller
        izinliYazmaAdresleri: [],           // Bu yol önekleri engellenmez (ör. kayıt yapmayan POST sorguları)
        hedefBekleme: 2500,                 // Sonradan çizilen öğe için en fazla bekleme (ms)
        modalKapat: null,                   // function (iframeWindow, iframeDocument) => açık pencere kapatıldıysa true
        metinler: null                      // Arayüz metinlerinin tamamı veya bir kısmı
    }, window.AnlatimAyar || {});

    var METIN_TR = {
        ekranBaslik: 'Anlatım ekranı',
        guvence: 'Kendi ekranınız · hiçbir değişiklik kaydedilmez',
        aciliyor: 'Ekran açılıyor…',
        hazirlaniyor: 'Ekran hazırlanıyor…',
        adimAlt: '{n} adım · kendi ekranınızda gösterilir',
        adimSayisi: '{n} adım',
        bitti: 'Hepsi bu kadar!',
        tamamlandi: '{baslik} anlatımı tamamlandı.',
        tekrarIzle: 'Tekrar izle',
        oynat: 'Anlatımı oynat',
        baslangic: 'Oynat düğmesine basın; anlatım gerçek ekranda adım adım gösterilir.',
        oynatDuraklat: 'Oynat / duraklat',
        onceki: 'Önceki adım',
        sonraki: 'Sonraki adım',
        bastan: 'Baştan oynat',
        tamEkran: 'Tam ekran',
        adimaGit: '{n}. adıma git: {baslik}',
        sorun: 'Anlatım oynatılırken bir sorun oluştu. Yazılı adımları izleyebilirsiniz.',
        acilamadi: 'Ekran açılamadı.',
        girisGerekli: 'Bu ekran açılamadı (yetkiniz olmayabilir veya oturumunuz sona ermiş olabilir).',
        engel: 'Bu ekranı açma yetkiniz yok. Yazılı adımları izleyebilirsiniz.',
        kayitYok: 'Bu adımı gösterebilmek için önce en az bir {ne} oluşturmalısınız. Yazılı adımları izleyebilirsiniz.',
        disAdres: 'Anlatım yalnızca bu sitenin ekranlarını açabilir.',
        ogeYok: '{ne} şu an ekranınızda görünmüyor; kaydın durumuna veya yetkinize bağlı olabilir. Anlatım devam ediyor.',
        buOge: 'Bu öğe',
        yazmaEngellendi: 'Anlatım sırasında kayıt isteği engellendi.'
    };
    var METIN_EN = {
        ekranBaslik: 'Walkthrough screen',
        guvence: 'Your own screen · nothing is saved',
        aciliyor: 'Opening screen…',
        hazirlaniyor: 'Preparing screen…',
        adimAlt: '{n} steps · shown on your own screen',
        adimSayisi: '{n} steps',
        bitti: 'That\'s it!',
        tamamlandi: '{baslik} walkthrough complete.',
        tekrarIzle: 'Watch again',
        oynat: 'Play walkthrough',
        baslangic: 'Press play to see each step on the real screen.',
        oynatDuraklat: 'Play / pause',
        onceki: 'Previous step',
        sonraki: 'Next step',
        bastan: 'Restart',
        tamEkran: 'Full screen',
        adimaGit: 'Go to step {n}: {baslik}',
        sorun: 'Something went wrong while playing. You can follow the written steps.',
        acilamadi: 'The screen could not be opened.',
        girisGerekli: 'This screen could not be opened (you may lack permission or your session may have expired).',
        engel: 'You do not have permission to open this screen. You can follow the written steps.',
        kayitYok: 'To show this step you first need at least one {ne}. You can follow the written steps.',
        disAdres: 'The walkthrough can only open screens from this site.',
        ogeYok: '{ne} is not visible on your screen right now; it may depend on the record or your permissions. Continuing.',
        buOge: 'This item',
        yazmaEngellendi: 'A save request was blocked during the walkthrough.'
    };
    var DIL = (document.documentElement.lang || '').toLowerCase();
    var M = Object.assign({}, DIL.indexOf('tr') === 0 ? METIN_TR : METIN_EN, AYAR.metinler || {});
    function m(anahtar, degerler) {
        return M[anahtar].replace(/\{(\w+)\}/g, function (t, k) { return degerler && degerler[k] != null ? degerler[k] : t; });
    }

    // 24x24 tek renkli simgeler; dış simge kütüphanesi gerekmez
    var SIMGELER = {
        'uygulama': 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
        'guvence': 'M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5zm-1.2 13.6l5.6-5.6-1.4-1.4-4.2 4.2-1.8-1.8-1.4 1.4z',
        'onay': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2L6.6 12 8 10.6l2.8 2.8 5.2-5.2 1.4 1.4z',
        'bilgi': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z',
        'oynat': 'M8 5v14l11-7z',
        'duraklat': 'M7 5h4v14H7zM13 5h4v14h-4z',
        'bastan': 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z',
        'onceki': 'M6 5h2v14H6zM19 5v14L9 12z',
        'sonraki': 'M16 5h2v14h-2zM5 5v14l10-7z',
        'tam': 'M4 9V4h5v2H6v3zM15 4h5v5h-2V6h-3zM4 15h2v3h3v2H4zM18 15h2v5h-5v-2h3z',
        'tamcikis': 'M9 4v5H4V7h3V4zM15 4h2v3h3v2h-5zM4 15h5v5H7v-3H4zM15 15h5v2h-3v3h-2z'
    };
    var azHareket = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var oynaticilar = [];

    function yap(etiket, sinif, metin) {
        var e = document.createElement(etiket);
        if (sinif) e.className = sinif;
        if (metin != null) e.textContent = metin;
        return e;
    }
    function ikon(ad) {
        var s = yap('span', 'an-ikon');
        s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="' + SIMGELER[ad] + '"/></svg>';
        return s;
    }
    function ikonDegistir(dugme, ad) { dugme.replaceChild(ikon(ad), dugme.firstChild); }
    function kucuk(s) {
        try { return (s || '').toLocaleLowerCase(DIL || undefined); }
        catch (e) { return (s || '').toLowerCase(); }
    }
    function rastgele(a, b) { return a + Math.random() * (b - a); }
    function sinirla(d, a, b) { return Math.max(a, Math.min(b, d)); }

    // ---- Gerçek ekranda öğe bulma ------------------------------------------------------------
    function gorunur(el) {
        if (!el || !el.getClientRects().length) return false;
        var r = el.getBoundingClientRect();
        return r.width > 0 || r.height > 0;
    }

    function bir(kok, s) {
        s = s.trim();
        var liste, i;
        if (s.indexOf('kart:') === 0) {
            var baslik = kucuk(s.slice(5));
            liste = kok.querySelectorAll(AYAR.kartSecici);
            for (i = 0; i < liste.length; i++) {
                var b = liste[i].querySelector(AYAR.kartBaslikSecici);
                if (b && b.closest(AYAR.kartSecici) === liste[i] && kucuk(b.textContent).indexOf(baslik) >= 0 && gorunur(liste[i])) return liste[i];
            }
            return null;
        }
        var ayrac = s.indexOf('|');
        var css = ayrac > 0 ? s.slice(0, ayrac) : s;
        var metin = ayrac > 0 ? kucuk(s.slice(ayrac + 1)) : null;
        try { liste = kok.querySelectorAll(css); } catch (e) { return null; }
        var ilk = null;
        for (i = 0; i < liste.length; i++) {
            if (metin && kucuk(liste[i].textContent).indexOf(metin) < 0) continue;
            if (gorunur(gorselHedef(liste[i]))) return liste[i];
            if (!ilk) ilk = liste[i];
        }
        return ilk;
    }

    function bul(doc, hedef) {
        if (!doc || !hedef) return null;
        var parcalar = hedef.split('>>');
        var el = bir(doc, parcalar[0]);
        for (var i = 1; el && i < parcalar.length; i++) el = bir(el, parcalar[i]);
        return el;
    }

    /** Görünmeyen girişlerin (btn-check, gizli onay kutusu) yerine etiketleri gösterilir. */
    function gorselHedef(el) {
        if (!el) return null;
        if (el.tagName === 'INPUT' && (el.classList.contains('btn-check') || !gorunur(el)) && el.id) {
            var l = el.ownerDocument.querySelector('label[for="' + el.id + '"]');
            if (l) return l;
        }
        return el;
    }

    function olay(el, ad) {
        try { el.dispatchEvent(new el.ownerDocument.defaultView.Event(ad, { bubbles: true })); } catch (e) { }
    }

    // iframe içine eklenen görsel durumlar (odak, basılma) ve kaydırma çubuğu gizleme
    var IC_STIL = '.yd-odak{outline:none!important;border-color:#2563eb!important;box-shadow:0 0 0 .25rem rgba(37,99,235,.25)!important}' +
        '.yd-basili{transform:scale(.94)!important;filter:brightness(.9)!important;transition:transform .12s,filter .12s!important}' +
        'html{scrollbar-width:none}::-webkit-scrollbar{width:0!important;height:0!important}';

    /**
     * Sayfa yüklendikten sonra iframe'den çıkan yazma isteklerini engeller; otomatik kaydeden alanlar anlatımda veri değiştirmesin.
     * Sayfanın yüklenirken kendi başına gönderdiği istekleri kapsamaz.
     */
    function yazmaEngeliKur(w) {
        if (!AYAR.yazmaEngeli || w.__anlatimEngeli) return;
        w.__anlatimEngeli = true;
        function serbest(adres, yontem) {
            yontem = String(yontem || 'GET').toUpperCase();
            if (yontem === 'GET' || yontem === 'HEAD') return true;
            var yol;
            try { yol = new w.URL(adres, w.location.href).pathname; } catch (e) { return false; }
            var izinli = AYAR.izinliYazmaAdresleri.some(function (o) { return yol.indexOf(o) === 0; });
            if (!izinli && window.console) console.info('[anlatim] yazma istegi engellendi:', yontem, yol);
            return izinli;
        }
        var fetchAsil = w.fetch;
        if (fetchAsil) {
            w.fetch = function (girdi, ayar) {
                var adres = typeof girdi === 'string' ? girdi : (girdi && girdi.url) || String(girdi);
                var yontem = (ayar && ayar.method) || (girdi && girdi.method) || 'GET';
                if (!serbest(adres, yontem)) return w.Promise.reject(new w.Error(M.yazmaEngellendi));
                return fetchAsil.apply(this, arguments);
            };
        }
        var X = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
        if (X) {
            var ac = X.open, gonder = X.send;
            X.open = function (yontem, adres) {
                this.__anlatimIzin = serbest(adres, yontem);
                return ac.apply(this, arguments);
            };
            X.send = function () {
                if (this.__anlatimIzin === false) throw new w.Error(M.yazmaEngellendi);
                return gonder.apply(this, arguments);
            };
        }
        if (w.navigator && w.navigator.sendBeacon) w.navigator.sendBeacon = function () { return false; };
    }

    /** Yalnızca aynı sitenin adresleri açılır (javascript: ve dış adresler reddedilir). */
    function ayniSite(adres) {
        try {
            var u = new URL(adres, window.location.href);
            return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin === window.location.origin;
        } catch (e) { return false; }
    }

    // ---------------------------------------------------------------------------------------
    function Oynatici(kok) {
        this.kok = kok;
        this.veri = JSON.parse(kok.querySelector('script[type="application/json"]').textContent);
        this.adimlar = this.veri.adimlar || [];
        this.modul = kok.getAttribute('data-modul') || '';
        this.ikon = kok.getAttribute('data-ikon') || '';   // İsteğe bağlı: tek karakter veya emoji
        this.durum = 'bekliyor';   // bekliyor | oynuyor | bitti
        this.duraklatildi = false;
        this.jeton = { iptal: false };
        this.aktif = -1;
        this.W = 1280; this.H = 760;
        this.kamera = { cx: 640, cy: 380, z: 1 };
        this.kur();
    }

    var P = Oynatici.prototype;

    P.kur = function () {
        var self = this, kok = this.kok;
        kok.innerHTML = '';
        kok.classList.add('an-hazir', 'an-basta');
        if (azHareket) kok.classList.add('an-az');

        var sahne = this.sahne = yap('div', 'an-sahne');

        // Ölçeklenen katman: gerçek ekran + vurgu
        var cerceve = this.cerceve = yap('div', 'an-cerceve');
        this.iframe = yap('iframe', 'an-iframe');
        this.iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
        this.iframe.setAttribute('tabindex', '-1');
        this.iframe.setAttribute('aria-hidden', 'true');
        this.iframe.title = m('ekranBaslik');
        cerceve.appendChild(this.iframe);
        this.isik = yap('div', 'an-isik');
        cerceve.appendChild(this.isik);
        sahne.appendChild(cerceve);

        // Ölçeklenmeyen katman: imleç, not balonu, açılır liste, bildirim
        var ust = this.ust = yap('div', 'an-ust');
        var canli = yap('div', 'an-canli');
        canli.appendChild(ikon('guvence'));
        canli.appendChild(document.createTextNode(' ' + m('guvence')));
        ust.appendChild(canli);
        this.imlec = yap('div', 'an-imlec');
        this.imlec.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 2.5l15 9.2-6.6 1.5 3.9 7.3-3 1.6-3.9-7.4L4.6 19z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
        ust.appendChild(this.imlec);
        this.balon = yap('div', 'an-balon');
        ust.appendChild(this.balon);
        this.bildirimKutu = yap('div', 'an-bildirim');
        this.bildirimKutu.appendChild(ikon('onay'));
        this.bildirimMetin = yap('span');
        this.bildirimKutu.appendChild(this.bildirimMetin);
        ust.appendChild(this.bildirimKutu);
        sahne.appendChild(ust);

        // Yükleniyor perdesi ve uyarı
        this.perde = yap('div', 'an-perde');
        this.perde.appendChild(yap('span', 'an-donen'));
        this.perdeMetin = yap('span', null, m('aciliyor'));
        this.perde.appendChild(this.perdeMetin);
        sahne.appendChild(this.perde);
        this.uyari = yap('div', 'an-uyari');
        this.uyari.appendChild(ikon('bilgi'));
        this.uyariMetin = yap('span');
        this.uyari.appendChild(this.uyariMetin);
        sahne.appendChild(this.uyari);

        // Giriş kartı (poster)
        var giris = this.girisKart = yap('div', 'an-kart an-giris an-goster');
        var gi = yap('div', 'an-kart-ikon'); gi.appendChild(this.ikon ? document.createTextNode(this.ikon) : ikon('uygulama'));
        giris.appendChild(gi);
        giris.appendChild(yap('small', 'an-kart-ust', this.modul));
        giris.appendChild(yap('h3', null, this.veri.baslik));
        if (this.veri.ozet) giris.appendChild(yap('p', null, this.veri.ozet));
        giris.appendChild(yap('span', 'an-kart-alt', m('adimAlt', { n: this.adimlar.length })));
        sahne.appendChild(giris);

        // Kapanış kartı
        var kapanis = this.kapanisKart = yap('div', 'an-kart an-kapanis');
        var tik = yap('div', 'an-tamam');
        tik.innerHTML = '<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg>';
        kapanis.appendChild(tik);
        kapanis.appendChild(yap('h3', null, m('bitti')));
        kapanis.appendChild(yap('p', null, m('tamamlandi', { baslik: this.veri.baslik })));
        var tekrar = yap('button', 'an-kart-dugme');
        tekrar.type = 'button';
        tekrar.appendChild(ikon('bastan'));
        tekrar.appendChild(document.createTextNode(' ' + m('tekrarIzle')));
        tekrar.addEventListener('click', function (e) { e.stopPropagation(); self.calistir(0, true); });
        kapanis.appendChild(tekrar);
        sahne.appendChild(kapanis);

        var buyuk = this.buyuk = yap('button', 'an-buyuk');
        buyuk.type = 'button';
        buyuk.setAttribute('aria-label', m('oynat'));
        buyuk.appendChild(ikon('oynat'));
        sahne.appendChild(buyuk);

        sahne.addEventListener('click', function () { self.oynatDuraklat(); });
        kok.appendChild(sahne);

        // Alt yazı (sahnenin altında, gerçek boyutta)
        var alt = this.altyazi = yap('div', 'an-altyazi');
        alt.setAttribute('aria-live', 'polite');
        this.altNo = yap('span', 'an-alt-no', m('adimSayisi', { n: this.adimlar.length }));
        var altMetin = yap('div', 'an-alt-metin');
        this.altBaslik = yap('b', null, this.veri.baslik);
        this.altAciklama = yap('p', null, m('baslangic'));
        altMetin.appendChild(this.altBaslik);
        altMetin.appendChild(this.altAciklama);
        alt.appendChild(this.altNo);
        alt.appendChild(altMetin);
        kok.appendChild(alt);

        // Kontroller
        var k = yap('div', 'an-kontrol');
        this.dOynat = this.kontrolDugme(k, 'oynat', m('oynatDuraklat'), function () { self.oynatDuraklat(); });
        this.kontrolDugme(k, 'onceki', m('onceki'), function () { self.git(Math.max(0, self.aktif - 1)); });
        this.kontrolDugme(k, 'sonraki', m('sonraki'), function () {
            if (self.aktif < self.adimlar.length - 1) self.git(self.aktif + 1);
        });
        var seritler = this.seritler = yap('div', 'an-seritler');
        this.adimlar.forEach(function (a, i) {
            var s = yap('button', 'an-serit');
            s.type = 'button';
            s.title = (i + 1) + '. ' + a.baslik;
            s.setAttribute('aria-label', m('adimaGit', { n: i + 1, baslik: a.baslik }));
            s.appendChild(yap('i'));
            s.addEventListener('click', function () { self.git(i); });
            seritler.appendChild(s);
        });
        k.appendChild(seritler);
        this.sayac = yap('span', 'an-sayac', '0 / ' + this.adimlar.length);
        k.appendChild(this.sayac);
        this.kontrolDugme(k, 'bastan', m('bastan'), function () { self.calistir(0, true); });
        this.dTam = this.kontrolDugme(k, 'tam', m('tamEkran'), function () { self.tamEkran(); });
        kok.appendChild(k);

        document.addEventListener('fullscreenchange', function () {
            var tam = document.fullscreenElement === kok;
            ikonDegistir(self.dTam, tam ? 'tamcikis' : 'tam');
            setTimeout(function () { self.olcekle(); }, 60);
        });

        kok.tabIndex = 0;
        kok.addEventListener('keydown', function (e) {
            if (e.target !== kok) return;
            if (e.key === ' ' || e.key === 'k') { e.preventDefault(); self.oynatDuraklat(); }
            else if (e.key === 'ArrowRight' && self.aktif < self.adimlar.length - 1) self.git(self.aktif + 1);
            else if (e.key === 'ArrowLeft') self.git(Math.max(0, self.aktif - 1));
        });

        this.modBelirle();
        this.olcekle();
        if (window.ResizeObserver) new ResizeObserver(function () { self.olcekle(); }).observe(kok);
        else window.addEventListener('resize', function () { self.olcekle(); });
        this.kontrolGuncelle();
    };

    P.kontrolDugme = function (kap, ik, baslik, isle) {
        var d = yap('button', 'an-k-dugme');
        d.type = 'button';
        d.title = baslik;
        d.setAttribute('aria-label', baslik);
        d.appendChild(ikon(ik));
        d.addEventListener('click', isle);
        kap.appendChild(d);
        return d;
    };

    // ---- Ölçek ve kamera ------------------------------------------------------------------------
    /** Dar ekranda (telefon) sayfa mobil görünümüyle açılır. Mod değiştiyse true döner. */
    P.modBelirle = function () {
        var dar = this.kok.clientWidth > 0 && this.kok.clientWidth < 620 && document.fullscreenElement !== this.kok;
        var W = dar ? 430 : 1280, H = 760;
        var degisti = W !== this.W;
        this.W = W; this.H = H;
        this.iframe.style.width = W + 'px';
        this.iframe.style.height = H + 'px';
        this.cerceve.style.width = W + 'px';
        this.cerceve.style.height = H + 'px';
        this.kok.style.setProperty('--an-oran', String(W / H));
        this.kok.classList.toggle('an-dar', dar);
        return degisti;
    };

    P.olcekle = function () {
        var g = this.sahne.clientWidth || this.W;
        this.sahne.style.height = Math.round(g * this.H / this.W) + 'px';
        this.olcek = g / this.W;
        this.kameraUygula(false);
    };

    P.kameraUygula = function (gecis) {
        var sw = this.sahne.clientWidth || this.W, sh = this.sahne.clientHeight || this.H;
        var S = this.olcek * this.kamera.z;
        var tx = sinirla(sw / 2 - this.kamera.cx * S, sw - this.W * S, 0);
        var ty = sinirla(sh / 2 - this.kamera.cy * S, sh - this.H * S, 0);
        this.cerceve.style.transition = gecis && !azHareket ? '' : 'none';
        this.cerceve.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + S + ')';
        this.tx = tx; this.ty = ty; this.S = S;
    };

    /** iframe içindeki bir dikdörtgenin sahne üzerindeki (ölçeklenmemiş) konumu */
    P.ekranda = function (r) {
        return { x: this.tx + r.left * this.S, y: this.ty + r.top * this.S, w: r.width * this.S, h: r.height * this.S };
    };

    P.kameraGenel = function (j) {
        var k = this.kamera;
        if (k.z === 1 && k.cx === this.W / 2 && k.cy === this.H / 2) return Promise.resolve();
        this.kamera = { cx: this.W / 2, cy: this.H / 2, z: 1 };
        this.kameraUygula(true);
        return this.bekle(j, 650);
    };

    /** Öğeyi iframe içinde görünür alana kaydırır ve kamerayı ona yaklaştırır. */
    P.odakla = function (j, g, genis) {
        var self = this;
        var w = this.iframe.contentWindow;
        var r = g.getBoundingClientRect();
        var sonra = Promise.resolve();
        if (r.top < 64 || r.bottom > this.H - 16) {
            var sabit = g.closest('.modal') || w.getComputedStyle(g).position === 'fixed';
            if (!sabit) {
                var hedefY = w.scrollY + r.top + r.height / 2 - this.H / 2;
                w.scrollTo({ top: Math.max(0, hedefY), behavior: azHareket ? 'auto' : 'smooth' });
                sonra = this.bekle(j, 600);
            }
        }
        return sonra.then(function () {
            var r2 = g.getBoundingClientRect();
            var sw = self.sahne.clientWidth, sh = self.sahne.clientHeight;
            var sigar = Math.min(sw / ((r2.width + 90) * self.olcek), sh / ((r2.height + 140) * self.olcek));
            var enFazla = self.olcek < 0.7 ? 1.75 : 1.35;
            var z = sinirla(genis ? sigar : Math.min(sigar, enFazla), 1, enFazla);
            self.kamera = { cx: r2.left + r2.width / 2, cy: r2.top + r2.height / 2, z: z };
            self.kameraUygula(true);
            return self.bekle(j, 700);
        });
    };

    P.tamEkran = function () {
        if (document.fullscreenElement === this.kok) document.exitFullscreen();
        else if (this.kok.requestFullscreen) this.kok.requestFullscreen();
    };

    // ---- Oynatma durumu -----------------------------------------------------------------------
    P.oynatDuraklat = function () {
        if (this.durum !== 'oynuyor') { this.calistir(0, true); return; }
        this.duraklatildi = !this.duraklatildi;
        if (!this.duraklatildi) this.digerleriniDurdur();
        this.kontrolGuncelle();
    };

    P.durdur = function () {
        if (this.durum === 'oynuyor' && !this.duraklatildi) {
            this.duraklatildi = true;
            this.kontrolGuncelle();
        }
    };

    P.digerleriniDurdur = function () {
        var self = this;
        oynaticilar.forEach(function (o) { if (o !== self) o.durdur(); });
    };

    P.kontrolGuncelle = function () {
        var oynuyor = this.durum === 'oynuyor' && !this.duraklatildi;
        ikonDegistir(this.dOynat, oynuyor ? 'duraklat' : (this.durum === 'bitti' ? 'bastan' : 'oynat'));
        this.kok.classList.toggle('an-oynuyor', oynuyor);
        this.kok.classList.toggle('an-duraklatildi', this.durum === 'oynuyor' && this.duraklatildi);
        this.kok.classList.toggle('an-basta', this.durum === 'bekliyor');
        ikonDegistir(this.buyuk, this.durum === 'bitti' ? 'bastan' : 'oynat');
    };

    /** Duraklatmaya uyan bekleme; iptal edilen oynatma IPTAL ile kesilir. Hızlı modda (adıma atlama) neredeyse beklenmez. */
    P.bekle = function (j, ms) {
        var self = this;
        if (j.hizli) ms = Math.min(ms, 30);
        else if (azHareket) ms = ms > 500 ? Math.min(ms * 1.1, 4000) : ms * 0.3;
        j.gecen += ms;
        return new Promise(function (coz, red) {
            var kalan = ms, son = performance.now();
            function tik() {
                var t = performance.now();
                if (j.iptal) { red(IPTAL); return; }
                if (!self.duraklatildi) kalan -= (t - son);
                son = t;
                if (kalan <= 0) coz(); else setTimeout(tik, Math.min(40, Math.max(4, kalan)));
            }
            setTimeout(tik, Math.min(40, ms));
        });
    };

    P.git = function (i) { this.calistir(i, false); };

    P.calistir = function (bas, giris) {
        var self = this;
        this.jeton.iptal = true;
        var j = this.jeton = { iptal: false, gecen: 0, hizli: false };
        this.duraklatildi = false;
        this.durum = 'oynuyor';
        this.digerleriniDurdur();
        this.kontrolGuncelle();
        this.kok.focus({ preventScroll: true });
        this.kapanisKart.classList.remove('an-goster');
        this.temizle();
        if (this.modBelirle()) this.yuklu = null;
        this.olcekle();

        (async function () {
            if (giris) await self.giris(j);
            else self.girisKart.classList.remove('an-goster');
            // Ortadan başlanırsa o adımın ekranı, önceki adımlar hızlıca uygulanarak hazırlanır
            var temel = bas;
            while (temel > 0 && !self.adimlar[temel].url) temel--;
            if (temel < bas) {
                j.hizli = true;
                self.perdeGoster(m('hazirlaniyor'));
                for (var k = temel; k < bas; k++) await self.adimOynat(j, k);
                j.hizli = false;
                self.perdeGizle();
            }
            for (var i = bas; i < self.adimlar.length; i++) await self.adimOynat(j, i);
            await self.kapanis(j);
            if (j.iptal) return;
            self.durum = 'bitti';
            self.kontrolGuncelle();
        })().catch(function (e) {
            if (e === IPTAL) return;
            self.perdeGizle();
            self.uyariGoster(m('sorun'));
            if (window.console) console.error(e);
        });
    };

    P.temizle = function () {
        this.isikGizle();
        this.balonGizle();
        this.bildirimGizle();
        this.uyariGizle();
        this.acilirKaldir();
    };

    P.giris = function (j) {
        var self = this, kart = this.girisKart;
        this.imlec.classList.remove('an-gorunur');
        this.seritGuncelle(-1, 0);
        kart.classList.remove('an-goster', 'an-canli');
        void kart.offsetWidth;
        kart.classList.add('an-goster', 'an-canli');
        return this.bekle(j, 2300).then(function () {
            kart.classList.remove('an-goster');
            return self.bekle(j, 300);
        });
    };

    P.kapanis = function (j) {
        var self = this;
        return this.bekle(j, 300).then(function () {
            self.temizle();
            self.imlec.classList.remove('an-gorunur');
            self.kapanisKart.classList.add('an-goster');
            self.yaziliVurgula(-1);
            return self.bekle(j, 400);
        });
    };

    // ---- Sayfa yükleme --------------------------------------------------------------------------
    P.perdeGoster = function (metin) {
        this.perdeMetin.textContent = metin || m('aciliyor');
        this.perde.classList.add('an-goster');
    };
    P.perdeGizle = function () { this.perde.classList.remove('an-goster'); };

    P.belge = function () {
        try { return this.iframe.contentDocument; } catch (e) { return null; }
    };

    P.yukle = function (j, url) {
        var self = this;
        this.temizle();
        if (!ayniSite(url)) {
            this.sayfaHatasi = m('disAdres');
            this.yuklu = null;
            return Promise.resolve();
        }
        this.imlec.classList.remove('an-gorunur');
        if (!j.hizli) this.perdeGoster();
        this.kamera = { cx: this.W / 2, cy: this.H / 2, z: 1 };
        this.kameraUygula(false);
        return new Promise(function (coz) {
            var bitti = false;
            function tamam() {
                if (bitti) return;
                bitti = true;
                clearTimeout(zaman);
                self.iframe.removeEventListener('load', tamam);
                coz();
            }
            var zaman = setTimeout(tamam, 20000);
            self.iframe.addEventListener('load', tamam);
            var w = self.iframe.contentWindow;
            if (self.yuklu && w) { try { w.location.replace(url); return; } catch (e) { } }
            self.iframe.src = url;
        }).then(function () {
            if (j.iptal) throw IPTAL;
            self.yuklu = url;
            self.sayfaHazirla();
            return self.bekle(j, 450);
        }).then(function () {
            if (!j.hizli) self.perdeGizle();
        });
    };

    /** Yüklenen sayfayı denetler: beklenen ekran mı, yetki var mı. Yazma engeli burada kurulur. */
    P.sayfaHazirla = function () {
        var doc = this.belge();
        this.sayfaHatasi = null;
        if (!doc || !doc.body) { this.sayfaHatasi = m('acilamadi'); return; }
        yazmaEngeliKur(this.iframe.contentWindow);
        var stil = doc.createElement('style');
        stil.textContent = IC_STIL;
        (doc.head || doc.body).appendChild(stil);
        var engel = AYAR.engelSecici && doc.querySelector(AYAR.engelSecici);
        if (engel) {
            this.sayfaHatasi = engel.getAttribute('data-anlatim-engel') || m('engel');
        } else if (AYAR.sayfaSecici && !doc.querySelector(AYAR.sayfaSecici)) {
            this.sayfaHatasi = m('girisGerekli');
        }
    };

    P.modallariKapat = function () {
        var w = this.iframe.contentWindow, doc = this.belge();
        if (w && doc && AYAR.modalKapat) return !!AYAR.modalKapat(w, doc);
        if (!w || !doc || !w.bootstrap) return false;
        var acik = doc.querySelectorAll('.modal.show');
        acik.forEach(function (m) { var o = w.bootstrap.Modal.getInstance(m); if (o) o.hide(); });
        return acik.length > 0;
    };

    // ---- Adım -----------------------------------------------------------------------------------
    P.adimOynat = async function (j, i) {
        var a = this.adimlar[i];
        var sinir = j.gecen;
        if (!j.hizli) {
            this.aktif = i;
            this.sayac.textContent = (i + 1) + ' / ' + this.adimlar.length;
            this.seritGuncelle(i, 0);
            this.yaziliVurgula(i);
            this.altyaziGoster(i, a);
            this.temizle();
        }
        var okuma = 3400 + (a.metin || '').length * 34;

        if (a.url) {
            if (a.url.indexOf('#yok:') === 0) {
                j.sayfaYok = m('kayitYok', { ne: a.url.slice(5) });
            } else {
                j.sayfaYok = null;
                await this.yukle(j, a.url);
            }
        }
        if (j.sayfaYok || this.sayfaHatasi || !this.yuklu) {
            if (!j.hizli) {
                this.uyariGoster(j.sayfaYok || this.sayfaHatasi || m('acilamadi'));
                await this.bekle(j, okuma);
                this.seritGuncelle(i, 1);
            }
            return;
        }

        var ilk = a.eylemler && a.eylemler[0];
        if (!a.url && !(ilk && /modal/i.test(ilk.hedef || '')) && this.modallariKapat()) await this.bekle(j, 400);
        if (!j.hizli) await this.kameraGenel(j);

        var eylemler = a.eylemler || [];
        for (var k = 0; k < eylemler.length; k++) {
            await this.eylem(j, eylemler[k]);
            if (!j.hizli) this.seritGuncelle(i, (k + 1) / (eylemler.length + 1));
        }
        if (j.hizli) return;

        this.isikGizle();
        if (a.sonuc) this.bildirimGoster(a.sonuc);
        var gecen = j.gecen - sinir;
        await this.bekle(j, Math.max(a.sonuc ? 2200 : 1200, okuma - gecen));
        this.bildirimGizle();
        this.seritGuncelle(i, 1);
    };

    P.altyaziGoster = function (i, a) {
        var alt = this.altyazi;
        alt.classList.remove('an-yeni');
        void alt.offsetWidth;
        this.altNo.textContent = (i + 1) + '/' + this.adimlar.length;
        this.altBaslik.textContent = a.baslik;
        this.altAciklama.textContent = a.metin;
        alt.classList.add('an-yeni');
    };

    P.bildirimGoster = function (metin) {
        this.bildirimMetin.textContent = metin;
        this.bildirimKutu.classList.remove('an-goster');
        void this.bildirimKutu.offsetWidth;
        this.bildirimKutu.classList.add('an-goster');
    };
    P.bildirimGizle = function () { this.bildirimKutu.classList.remove('an-goster'); };

    P.uyariGoster = function (metin) {
        this.uyariMetin.textContent = metin;
        this.uyari.classList.add('an-goster');
    };
    P.uyariGizle = function () { this.uyari.classList.remove('an-goster'); };

    P.seritGuncelle = function (aktif, oran) {
        var s = this.seritler.children;
        for (var i = 0; i < s.length; i++) {
            var d = i < aktif ? 1 : (i === aktif ? oran : 0);
            s[i].firstChild.style.width = (d * 100) + '%';
            s[i].classList.toggle('an-aktif', i === aktif);
        }
    };

    P.yaziliVurgula = function (i) {
        var rehber = this.kok.closest('.yd-rehber');
        if (!rehber) return;
        rehber.querySelectorAll('[data-adim]').forEach(function (li) {
            li.classList.toggle('aktif', +li.getAttribute('data-adim') === i);
        });
    };

    // ---- Vurgu, not balonu, imleç ---------------------------------------------------------------
    P.isikGoster = function (g) {
        var r = g.getBoundingClientRect(), p = 6;
        var s = this.isik.style;
        s.left = (r.left - p) + 'px'; s.top = (r.top - p) + 'px';
        s.width = (r.width + p * 2) + 'px'; s.height = (r.height + p * 2) + 'px';
        this.isik.classList.add('an-goster');
    };
    P.isikGizle = function () { this.isik.classList.remove('an-goster'); };

    P.balonGoster = function (g, metin) {
        var b = this.balon, e = this.ekranda(g.getBoundingClientRect());
        var sw = this.sahne.clientWidth, sh = this.sahne.clientHeight;
        b.textContent = metin;
        b.className = 'an-balon';
        b.style.left = '0px'; b.style.top = '0px';
        var bw = Math.min(b.offsetWidth || 260, sw - 16), bh = b.offsetHeight || 40;
        var asagi = e.y + e.h + bh + 18 < sh;
        var x = sinirla(e.x + e.w / 2 - bw / 2, 8, sw - bw - 8);
        var y = asagi ? e.y + e.h + 12 : Math.max(8, e.y - bh - 12);
        b.style.left = x + 'px';
        b.style.top = y + 'px';
        b.style.setProperty('--ok', sinirla(e.x + e.w / 2 - x, 14, bw - 14) + 'px');
        b.classList.add(asagi ? 'an-asagi' : 'an-yukari', 'an-goster');
    };
    P.balonGizle = function () { this.balon.classList.remove('an-goster'); };

    P.imlecGit = function (j, g, solaYakin) {
        var e = this.ekranda(g.getBoundingClientRect()), im = this.imlec;
        var x = solaYakin ? e.x + Math.min(30, e.w * 0.3) : e.x + e.w / 2;
        var y = e.y + e.h / 2;
        if (!im.classList.contains('an-gorunur')) {
            im.style.transition = 'none';
            im.style.transform = 'translate(' + (this.sahne.clientWidth * 0.6) + 'px,' + (this.sahne.clientHeight * 0.85) + 'px)';
            void im.offsetWidth;
            im.style.transition = '';
            im.classList.add('an-gorunur');
        }
        im.style.transform = 'translate(' + (x - 4) + 'px,' + (y - 3) + 'px)';
        this.imlecX = x; this.imlecY = y;
        return this.bekle(j, 720);
    };

    P.tikla = function (j, g) {
        var self = this, im = this.imlec;
        var dalga = yap('span', 'an-dalga');
        dalga.style.left = this.imlecX + 'px';
        dalga.style.top = this.imlecY + 'px';
        this.ust.appendChild(dalga);
        setTimeout(function () { dalga.remove(); }, 900);
        im.classList.add('an-basildi');
        if (g) g.classList.add('yd-basili');
        return this.bekle(j, 220).then(function () {
            im.classList.remove('an-basildi');
            if (g) g.classList.remove('yd-basili');
            return self.bekle(j, 120);
        });
    };

    // ---- Eylemler -------------------------------------------------------------------------------
    /** SPA gibi öğesini yüklendikten sonra çizen ekranlar için hedefi kısa süre bekler. */
    P.hedefBekle = async function (j, hedef) {
        var el = bul(this.belge(), hedef), kalan = AYAR.hedefBekleme;
        while ((!el || !gorunur(gorselHedef(el))) && kalan > 0) {
            await this.bekle(j, 100);
            kalan -= 100;
            el = bul(this.belge(), hedef);
        }
        return el;
    };

    P.eylem = async function (j, e) {
        var el = await this.hedefBekle(j, e.hedef);
        var g = gorselHedef(el);
        if (!g || !gorunur(g)) {
            if (!j.hizli) await this.eksik(j, e);
            return;
        }
        if (j.hizli) { await this.hizliUygula(j, e, el); return; }

        await this.odakla(j, g, e.tur === 'goster');
        this.isikGoster(g);
        if (e.not) this.balonGoster(g, e.not);

        switch (e.tur) {
            case 'goster':
                await this.imlecGit(j, g);
                await this.bekle(j, 1500 + (e.not || '').length * 28);
                break;
            case 'yaz':
                await this.imlecGit(j, g, true);
                await this.tikla(j, null);
                await this.yaz(j, el, e.deger || '');
                break;
            case 'sec':
                // Değer verilmemiş ve alan zaten seçiliyse (ör. sorgulamayla dolduysa) değiştirilmez, sadece gösterilir
                if (!e.deger && el.value) { await this.imlecGit(j, g); await this.bekle(j, 1400); break; }
                await this.imlecGit(j, g);
                await this.tikla(j, g);
                this.balonGizle();
                await this.sec(j, el, e.deger);
                break;
            case 'isaret':
                await this.imlecGit(j, g);
                await this.tikla(j, g);
                isaretle(el);
                await this.bekle(j, 450);
                break;
            case 'tikla':
                await this.imlecGit(j, g);
                await this.tikla(j, g);
                await this.bekle(j, 350);
                break;
            case 'ac':
            case 'calistir':
                await this.imlecGit(j, g);
                await this.tikla(j, g);
                this.isikGizle();
                el.click();
                await this.bekle(j, 900);
                break;
            case 'git':
                await this.imlecGit(j, g);
                await this.tikla(j, g);
                await this.yukle(j, el.getAttribute('href'));
                break;
        }
        if (e.not && e.tur !== 'goster') await this.bekle(j, 700);
        this.balonGizle();
    };

    function isaretle(el) {
        if (el.type === 'radio' || el.type === 'checkbox') {
            if (!el.checked) { el.checked = true; olay(el, 'change'); }
        }
    }

    function secenekBul(el, deger) {
        var ops = Array.prototype.filter.call(el.options, function (o) { return !o.disabled; });
        var hedef = null;
        if (deger) hedef = ops.filter(function (o) { return kucuk(o.text).indexOf(kucuk(deger)) >= 0; })[0];
        if (!hedef) hedef = ops.filter(function (o) { return o.value !== ''; })[0] || ops[0];
        return { ops: ops, hedef: hedef };
    }

    function secimUygula(el, o) {
        if (!o) return;
        el.value = o.value;
        olay(el, 'change');
    }

    P.hizliUygula = async function (j, e, el) {
        switch (e.tur) {
            case 'yaz': el.value = e.deger || ''; olay(el, 'input'); olay(el, 'change'); break;
            case 'sec': if (el.options && (e.deger || !el.value)) secimUygula(el, secenekBul(el, e.deger).hedef); break;
            case 'isaret': isaretle(el); break;
            case 'ac': case 'calistir': el.click(); await this.bekle(j, 400); break;
            case 'git': await this.yukle(j, el.getAttribute('href')); break;
        }
    };

    P.yaz = async function (j, el, metin) {
        el.classList.add('yd-odak');
        var tarih = /^(date|time|datetime-local|month)$/.test(el.type);
        if (tarih || azHareket) {
            el.value = metin;
            await this.bekle(j, 500);
        } else {
            el.value = '';
            for (var i = 0; i < metin.length; i++) {
                el.value += metin.charAt(i);
                if (el.scrollLeft !== undefined) el.scrollLeft = el.scrollWidth;
                await this.bekle(j, rastgele(40, 85));
            }
        }
        olay(el, 'input');
        olay(el, 'change');
        await this.bekle(j, 350);
        el.classList.remove('yd-odak');
    };

    /** Yerel açılır liste programla açılamadığı için seçenekler sahnede gösterilir; seçim gerçek listeye uygulanır. */
    P.sec = async function (j, el, deger) {
        if (!el.options) return;
        var s = secenekBul(el, deger);
        if (!s.hedef) return;
        var e = this.ekranda(el.getBoundingClientRect());
        var liste = this.acilir = yap('div', 'an-acilir');
        var bas = Math.max(0, Math.min(s.ops.indexOf(s.hedef) - 2, s.ops.length - 6));
        var hedefSatir = null;
        s.ops.slice(bas, bas + 6).forEach(function (o) {
            var d = yap('div', o === s.hedef ? 'an-secenek' : null, o.text || '—');
            if (o === s.hedef) hedefSatir = d;
            liste.appendChild(d);
        });
        liste.style.left = e.x + 'px';
        liste.style.top = (e.y + e.h + 4) + 'px';
        liste.style.minWidth = Math.max(180, e.w) + 'px';
        this.ust.appendChild(liste);
        var sh = this.sahne.clientHeight;
        if (e.y + e.h + 4 + liste.offsetHeight > sh - 6) liste.style.top = Math.max(6, e.y - liste.offsetHeight - 4) + 'px';
        el.classList.add('yd-odak');
        await this.bekle(j, 450);
        var r = hedefSatir.getBoundingClientRect(), u = this.sahne.getBoundingClientRect();
        var im = this.imlec;
        this.imlecX = r.left - u.left + 28; this.imlecY = r.top - u.top + r.height / 2;
        im.style.transform = 'translate(' + (this.imlecX - 4) + 'px,' + (this.imlecY - 3) + 'px)';
        await this.bekle(j, 650);
        hedefSatir.classList.add('an-ustunde');
        await this.tikla(j, null);
        this.acilirKaldir();
        secimUygula(el, s.hedef);
        el.classList.remove('yd-odak');
        await this.bekle(j, 600);
    };

    P.acilirKaldir = function () {
        if (this.acilir) { this.acilir.remove(); this.acilir = null; }
    };

    P.eksik = async function (j, e) {
        this.isikGizle();
        if (window.console) console.warn('[anlatim] hedef bulunamadi:', e.hedef);
        this.uyariGoster(m('ogeYok', { ne: e.not ? '"' + e.not + '"' : M.buOge }));
        await this.bekle(j, 2600);
        this.uyariGizle();
    };

    // ---------------------------------------------------------------------------------------
    function baslat() {
        document.querySelectorAll('[data-anlatim]').forEach(function (k) {
            try { oynaticilar.push(new Oynatici(k)); }
            catch (e) { if (window.console) console.error('Anlatım yüklenemedi', e); }
        });

        // Yazılı adımdaki "izle" düğmesi: oynatıcıyı o adımdan başlatır
        document.addEventListener('click', function (e) {
            var d = e.target.closest('[data-adim-izle]');
            if (!d) return;
            var rehber = d.closest('.yd-rehber');
            var kok = rehber && rehber.querySelector('[data-anlatim]');
            var o = oynaticilar.filter(function (x) { return x.kok === kok; })[0];
            if (!o) return;
            var r = kok.getBoundingClientRect();
            if (r.top < 60 || r.bottom > window.innerHeight) kok.scrollIntoView({ behavior: azHareket ? 'auto' : 'smooth', block: 'start' });
            o.git(+d.getAttribute('data-adim-izle'));
        });

        // Ekrandan çıkan anlatım duraklar
        if (window.IntersectionObserver) {
            var io = new IntersectionObserver(function (girdiler) {
                girdiler.forEach(function (g) {
                    if (!g.isIntersecting) {
                        var o = oynaticilar.filter(function (x) { return x.kok === g.target; })[0];
                        if (o && document.fullscreenElement !== o.kok) o.durdur();
                    }
                });
            }, { threshold: 0.1 });
            oynaticilar.forEach(function (o) { io.observe(o.kok); });
        }
    }

    window.YardimAnlatim = { oynaticilar: oynaticilar };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
    else baslat();
})();
