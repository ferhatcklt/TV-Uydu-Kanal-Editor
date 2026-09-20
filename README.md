# Evrensel TV & Uydu Kanal Editörü

Web tabanlı, çok markalı kanal sıralama, düzenleme ve format dönüştürme aracı. Elton, Sunny, Vestel, Toshiba, Regal, SEG gibi televizyonların USB kanal listelerini düzenleyin, gereksizleri temizleyin ve istediğiniz markanın formatına dönüştürerek TV'nize aktarın.

![Python](https://img.shields.io/badge/Python-3.7+-3776AB?logo=python&logoColor=white)
![License](https://img.shields.io/badge/Lisans-MIT-green)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

## Özellikler

- 🛰️ **Çok Markalı Format Desteği:** 
  - `CHANNELLIST.bin` (ALi Çipset - Elton, Sunny, Axen, Awox)
  - `.sdx` (Vestel, Regal, Toshiba, SEG, JVC - SatcoDX Standardı)
  - `.m3u` (Smart IPTV, Android TV, VLC Player)
  - `.csv` & `.json` (Excel ve veri yedekleme)
- 🔄 **Tek Tıkla Format Dönüştürme:** Bir markanın listesini diğer markanın formatına dönüştürüp indirme.
- 📁 **Sürükle-Bırak Dosya Yükleme:** Kendi TV'nizden aldığınız USB yedeğini sayfaya sürükleyip anında düzenleme.
- 📋 **Kolay Sıralama:** Sürükle-bırak ile kanalları istediğiniz sıraya taşıma.
- 🧹 **Akıllı Temizleyici:** `Prog-108`, `Prog-150`, `TEST` gibi çöp kanalları tek tıkla kaldırma.
- ⭐ **Hazır Sıralamalar:** Standart Türk TV listesi (TRT 1, ATV, Kanal D, Show TV, Star...), Spor veya Haber kanallarını başa alma.
- ✏️ **Kanal İsmi Düzenleme & Silme:** Kanalları yeniden adlandırma veya silip geri yükleme.

## Desteklenen Formatlar ve Markalar

| Format | Hedef Cihazlar ve Markalar | Durum |
|--------|----------------------------|-------|
| `CHANNELLIST.bin` | Elton, Sunny, Axen, Awox, Hi-Level ve harici ALi uydu alıcıları | ✅ Okuma / Yazma |
| `sat_default.sdx` | Vestel, Regal, SEG, Toshiba, JVC, Telefunken, Daewoo, Finlux | ✅ Okuma / Yazma |
| `kanallar.m3u` | Smart IPTV, Android TV, TiviMate, VLC Player, TV Box | ✅ Dışa Aktarma |
| `kanallar.csv` | Excel tablosu (UTF-8 BOM destekli Türkçe karakterler) | ✅ Dışa Aktarma |
| `kanallar.json` | Evrensel JSON veri yedeği | ✅ Okuma / Yazma |

## Kurulum ve Çalıştırma

## Kolay Kullanım Yöntemleri

### 1. Yöntem: Sıfır Kurulum — Doğrudan Tarayıcıda Açın (GitHub Pages)
Herhangi bir program veya Python yüklemeden tarayıcınız üzerinden hemen kullanabilirsiniz:
👉 **[https://ferhatcklt.github.io/TV-Uydu-Kanal-Editor/](https://ferhatcklt.github.io/TV-Uydu-Kanal-Editor/)**

### 2. Yöntem: Windows Çift Tıkla Başlatıcı
1. Projeyi ZIP olarak indirin ve klasöre çıkartın.
2. `baslat.bat` dosyasına çift tıklayın.

### 3. Yöntem: macOS Çift Tıkla Başlatıcı
1. Projeyi ZIP olarak indirin ve klasöre çıkartın.
2. `baslat.command` dosyasına çift tıklayın.

### 4. Yöntem: Terminal / Komut Satırı
```bash
git clone https://github.com/ferhatcklt/TV-Uydu-Kanal-Editor.git
cd TV-Uydu-Kanal-Editor
python3 server.py
```
Tarayıcınız otomatik olarak `http://localhost:8080` adresinde açılacaktır.

## TV'ye USB ile Yükleme Adımları

### 1. Elton / Sunny / ALi Çipsetli Cihazlar
1. Üstten **ALi (.bin)** formatını seçip **"USB İçin İndir"** butonuna basın.
2. İndirilen `CHANNELLIST.bin` dosyasını FAT32 formatlı USB belleğinizin ana dizinine atın.
3. **ÖNEMLİ:** TV'de TKGS'yi kapatın: `Menü → Kurulum → TKGS Ayarları → KAPALI`
4. USB'yi TV'ye takın: `Menü → Kurulum → Uydu Ayarları → Kanal Tablosu → USB'den TV'ye Yükleme`

### 2. Vestel / Regal / Toshiba / SEG (.sdx)
1. Üstten **Vestel (.sdx)** formatını seçip indirin.
2. Dosyayı FAT32 USB belleğin ana dizinine kopyalayın.
3. TV menüsünden: `Menü → Ayarlar → Uydu Ayarları → Uydu Kanal Tablosu → USB'den TV'ye Yükleme`

### 3. Samsung & LG
- TV'nizin menüsünden (Samsung: `Yayın → Uzman Ayarları → Kanal Listesi Aktarımı`, LG: `Kanallar → Kanal Kopyalama`) USB'ye kanal yedeğinizi alın.
- Yedeğinizi web arayüzüne sürükleyip düzenleyin ve tekrar USB'den TV'ye aktarın.

## Dosya Yapısı

```
├── index.html              # Web arayüzü ve TV rehber modalı
├── app.js                  # Çevrimdışı ve çevrimiçi kanal sıralama & dönüştürücü motoru
├── style.css               # Modern dark-mode arayüz stilleri
├── server.py               # Çok formatlı Python backend sunucusu
├── baslat.bat              # Windows tek tık başlatıcı
├── baslat.command          # macOS tek tık başlatıcı
├── CHANNELLIST.bin          # Örnek hazır kanal listesi
└── README.md
```

## Lisans

MIT License — [Ferhat Çakıltaş](https://ferhat.tr)
