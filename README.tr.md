# EqhoAIOS

**AI Destekli Full-Stack Gelistirme Framework'u**

EqhoAIOS, 5 uzman AI ajanin bir Agile takim olarak birlikte calismasini saglayan gelistirme framework'udur. Claude API uzerine insa edilmistir ve iki fazli pipeline (Planlama + Gelistirme) ile fikirlerinizi gereksinimlerden incelenmis koda donusturur.

## Hizli Baslangic

```bash
# Kurulum
npm install -g eqho-aios

# Projenizde baslatma
cd projeniz
eqho-aios init

# Story olusturma
eqho-aios story create "Kullanici giris sistemi" --priority high

# Pipeline'i calistirma
export ANTHROPIC_API_KEY=sk-ant-...
eqho-aios run EQHO-001
```

## Nasil Calisir?

```
 Fikriniz
    |
    v
 [Analist] --> Gereksinimler & PRD
    |
    v
 [Mimar] --> Sistem Tasarimi & ADR'ler
    |
    v
 [Scrum Master] --> Story Dosyalari & Gorev Listeleri
    |
    v
 [Gelistirici] --> Implementasyon & Testler
    |
    v
 [QA] --> Inceleme & Verdikt
    |
    v
 Tamamlandi!
```

**Planlama Fazi:** Analist → Mimar → Scrum Master
**Gelistirme Fazi:** Scrum Master → Gelistirici → QA

Her ajan, onceki ajanin ciktisini story dosyasindan okur, kendi katkisini ekler ve baglami ileriye aktarir.

## Ajanlar

| Ajan | Isim | Faz | Gorev |
|------|------|-----|-------|
| `analyst` | Atlas | Planlama | Is analizi, PRD, gereksinimler, risk degerlendirmesi |
| `architect` | Aria | Planlama | Sistem mimarisi, API tasarimi, DB semasi, ADR'ler |
| `scrum_master` | River | Her ikisi | Story olusturma, sprint planlama, koordinasyon |
| `developer` | Dex | Gelistirme | Kod yazimi, unit testler, refactoring |
| `qa` | Quinn | Gelistirme | Kod inceleme, guvenlik kontrolu, kabul kriterleri |

## CLI Komutlari

```bash
# Proje yonetimi
eqho-aios init [isim]              # Proje baslatma
eqho-aios status                   # Proje durumu
eqho-aios config show              # Konfigurasyonu goster

# Story'ler
eqho-aios story create <baslik> [--priority high] [--tags auth,api]
eqho-aios story list [--status planning]
eqho-aios story show EQHO-001

# Pipeline
eqho-aios run EQHO-001                     # Tam pipeline
eqho-aios run EQHO-001 --phase planning    # Sadece planlama
eqho-aios run EQHO-001 --agent analyst     # Tek ajan
eqho-aios run EQHO-001 --auto              # Onay istemeden

# Ajanlar & Bildirimler
eqho-aios agent list                # Ajanlari listele
eqho-aios notify "Bitti!" --telegram
```

## Gereksinimler

- Node.js >= 18
- Anthropic API anahtari ([console.anthropic.com](https://console.anthropic.com))

## Lisans

MIT
