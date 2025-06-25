# Company Data API - Challenge Veridion

Dupa cateva zile intense de programare si experimentare, am reusit sa construiesc o solutie completa pentru challenge-ul Veridion. Aceasta documentatie reflecta gandirea mea din spatele fiecarei decizii tehnice si problemele pe care le-am intampinat.

## Cum Am Gandit Solutia

### Provocarea Initiala
Cand am citit prima data cerintele, mi-am dat seama ca trebuie sa rezolv 3 probleme distincte:
1. **Extragerea datelor** - cum sa scrapez 1000 de site-uri in mai putin de 10 minute
2. **Stocarea si cautarea** - cum sa fac matching inteligent intre query-uri si companii
3. **API-ul** - cum sa returnez rezultate relevante si sa masor acuratetea

### Strategia de Abordare
Am decis sa incep cu arhitectura inainte sa scriu prima linie de cod. Am ales **NestJS** pentru ca imi ofera un mediu structurat si scalabilitate din start.

##  Stack-ul Tehnic si Motivatia Alegerilor

### Web Scraping: Puppeteer + Cheerio
**De ce aceasta combinatie?**
- Am incercat initial doar cu `cheerio` si request-uri HTTP simple, dar multe site-uri moderne nu se incarcau complet
- **Puppeteer** imi garanteaza ca JavaScript-ul se executa si DOM-ul e complet incarcat
- **Cheerio** imi ofera flexibilitatea de a parse HTML-ul cu selectors jQuery-like

**Problema de performanta:**
Prima versiune scrapa site-urile secvential - 30+ minute pentru 1000 de site-uri! Am implementat procesare in batch-uri de 10 site-uri paralel si am ajuns la ~8 minute.

### Search Engine: Fuse.js
**De ce nu Elasticsearch?**
- Pentru 1000 de companii, overhead-ul unui server Elasticsearch separate ar fi fost prea mare
- **Fuse.js** imi ofera fuzzy search rapid in memorie
- Timp de raspuns sub-milisecunda pentru query-uri

**Challenge-ul algoritmului de matching:**
Am implementat 5 strategii diferite de matching pentru ca mi-am dat seama ca nu exista o solutie universala:

```typescript
1. Exact Domain Match (Score: 1.0) - pentru site-uri identice
2. Exact Phone Match (Score: 0.95) - telefoane normalizate  
3. Exact Facebook Match (Score: 0.9) - URL-uri sociale
4. Fuzzy Name Match - pentru nume similare dar nu identice
5. Combined Match - cand ai informatii partiale din multiple campuri
```

##  Problemele Majore Intampinate

### 1. Rate Limiting si Timeout-uri
**Problema:** Multe site-uri au protectii anti-bot sau sunt foarte lente
**Solutia:** Am implementat:
- Timeout de 10 secunde per site
- User agent realist
- Error handling robust cu retry logic

### 2. Extragerea Datelor Inconsistente
**Problema:** Fiecare site structureaza diferit informatiile
**Solutia:** Am dezvoltat multiple regex patterns pentru telefoane si addresses:

```typescript
// Pentru telefoane - am testat 4 formate diferite
const phoneRegexes = [
  /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,  // (555) 123-4567
  /\+?1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,  // +1 555 123 4567
  // ... etc
];
```

### 3. Normalizarea Datelor Pentru Matching
**Problema:** "facebook.com/company" vs "www.facebook.com/company/" - trebuie sa fie acelasi match
**Solutia:** Functii de normalizare pentru fiecare tip de data:

```typescript
private normalizeDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')  // Remove protocol
    .replace(/^www\./, '')        // Remove www
    .replace(/\/$/, '')           // Remove trailing slash
    .toLowerCase();
}
```

## Performantele Obtinute

### Rezultate Scraping (dupa optimizari)
Dupa testarea pe dataset-ul complet:
- **Total site-uri:** 997
- **Site-uri scrapeate cu succes:** ~658 (65.9% coverage)
- **Timp total:** 8-10 minute
- **Fill rates:**
  - Phone numbers: ~53.7%
  - Social media links: ~65.8% 
  - Addresses: ~23.1%

### Rezultate Matching
Testand cu `API-input-sample.csv`:
- **Total teste:** 32
- **Match-uri gasite:** 28
- **Match rate:** 87.5%
- **Timp raspuns mediu:** <5ms

**Exemple de match-uri reussite:**
```json
// Input: "SteppIR Tree Services", "steppir.com"
// Output: SteppIR Communication Systems (Score: 0.95)
// Matched pe domain + nume similar

// Input: "(317) 873-3230", "google.com" 
// Output: Garrett Wietholter - State Farm (Score: 0.95)
// Matched pe telefon exact
```

## Decizii de Design Importante

### 1. Arhitectura Modulara
Am structurat codul in servicii separate:
- `ScraperService` - logica de web scraping
- `SearchService` - algoritmii de matching  
- `CompanyService` - orchestrarea proceselor
- `CsvService` - management-ul datelor

**De ce?** Fiecare component poate fi testat si optimizat independent.

### 2. Strategii Multiple de Matching
In loc sa fac un algoritm "one size fits all", am implementat strategii specifice pentru fiecare scenariu.

**Rezultat:** Match rate de 87.5% comparativ cu ~60% cu fuzzy search simplu.

### 3. In-Memory Storage vs Database
**Decizie:** Pentru 1000 de companii, am ales in-memory storage
**Pro:** Raspunsuri instant, fara latenta de DB
**Con:** Nu scaleaza la milioane de records (dar pentru challenge e perfect)

## API-ul Final

### Endpoints Implementate
```bash
# Cautare companii
POST /api/companies/search
GET /api/companies/search?name=SteppIR&website=steppir.com

# Procesare date
POST /api/companies/scrape

# Analytics si testing
GET /api/companies/analytics
POST /api/companies/test
GET /api/companies/status
```

### Exemplu Raspuns API
```json
{
  "company": {
    "domain": "steppir.com",
    "company_commercial_name": "SteppIR Communication Systems",
    "phone_numbers": ["(425) 558-8585"],
    "social_media_links": {
      "facebook": "https://www.facebook.com/SteppIR/"
    }
  },
  "match_score": {
    "score": 0.95,
    "matched_fields": ["domain", "facebook"],
    "confidence": "high"
  }
}
```

## Masurarea Acuratetii (Bonus)

Am implementat un sistem de scoring pe 3 nivele:
- **High (0.8-1.0):** Match-uri exacte pe campuri cheie
- **Medium (0.6-0.8):** Similaritate buna cu unele match-uri exacte  
- **Low (<0.6):** Similaritate slaba dar inca relevanta

## Ce As Face Diferit

1. **Pentru scale mare:** As migra la Elasticsearch + Redis pentru caching
2. **Machine Learning:** As antrena un model pentru scoring mai inteligent
3. **Monitorizare:** As adauga metrics si alerting pentru productie


**Concluzie:** Această soluție demonstrează că poți construi un sistem de matching performant și scalabil cu tecnologii moderne. Am învățat mult despre optimizarea web scraping-ului și designul algoritmilor de search în procesul ăsta!


## Documentație Detaliată API

### Cum sa Rulezi Aplicatia

#### Pasi de Instalare si Rulare

```bash
# 1. Cloneaza repository-ul
git clone <repository-url>
cd interview

# 2. Instaleaza dependentele
npm install

# 3. Porneste aplicatia in modul development
npm run start:dev

# Aplicatia va rula pe http://localhost:3000
# Mesajul de succes: "Application is running on: http://localhost:3000"
```

#### Verificare Rapida
```bash
# Testeaza ca serverul functioneaza
http://localhost:3000/api/companies/status

# Ar trebui sa returneze statusul serviciului
```

### Documentatia Completa API

#### 1. **GET /api/companies/status**
Verifica statusul serviciului si statisticile de baza.

**Request:**
GET http://localhost:3000/api/companies/status

**Response:**
```json
{
  "initialized": true,
  "companies_count": 997,
  "scraped_data_count": 0,
  "analytics_available": false,
  "index_stats": {
    "total_companies": 997,
    "indexed": true
  }
}
```

#### 2. **POST /api/companies/scrape**
Porneste procesul de web scraping pentru toate site-urile.

**Request:**
POST http://localhost:3000/api/companies/scrape \


**Response:**
{
  "message": "Scraping completed successfully",
  "analytics": {
    "total_websites": 997,
    "successfully_crawled": 658,
    "coverage_percentage": 65.9,
    "fill_rates": {
      "phone_numbers": 53.7,
      "social_media": 65.8,
      "address": 23.1
    },
    "total_processing_time_ms": 485000,
    "average_time_per_website_ms": 567
  }
}

**Note:** Acest proces durează ~8-10 minute pentru toate site-urile.

#### 3. **GET /api/companies/analytics**
Returneaza analytics-urile de la ultimul scraping.

**Request:**
GET http://localhost:3000/api/companies/analytics

**Response:** (Same structure ca analytics din /scrape, sau message daca nu s-a rulat scraping)

#### 4. **POST /api/companies/search** PRINCIPAL
Cauta o companie folosind request body.

**Request:**
 POST http://localhost:3000/api/companies/search \
 body_example:{
    "name": "SteppIR Communication Systems",
    "website": "steppir.com",
    "phone": "(425) 558-8585",
    "facebook": "https://www.facebook.com/SteppIR/"
  }'


**Request Body Structure:**
```json
{
  "name": "string (optional)",        // Numele companiei
  "website": "string (optional)",     // Website-ul (cu sau fara http/https)
  "phone": "string (optional)",       // Numarul de telefon (orice format)
  "facebook": "string (optional)"     // URL-ul Facebook (orice format)
}
```

**Response (Success):**
```json
{
  "company": {
    "domain": "steppir.com",
    "company_commercial_name": "SteppIR Communication Systems",
    "company_legal_name": "SteppIR Inc.",
    "company_all_available_names": "SteppIR Communication Systems | SteppIR | SteppIR Inc.",
    "phone_numbers": ["(425) 558-8585"],
    "social_media_links": {
      "facebook": "https://www.facebook.com/SteppIR/"
    }
  },
  "match_score": {
    "score": 0.95,
    "matched_fields": ["domain", "facebook"],
    "confidence": "high"
  }
}
```

**Response (No Match):**
```json
{
  "statusCode": 404,
  "message": "No company found matching the criteria"
}
```

#### 5. **GET /api/companies/search** PRINCIPAL
Cauta o companie folosind query parameters.

**Request:**
GET "http://localhost:3000/api/companies/search?name=SteppIR&website=steppir.com&phone=(425)558-8585"
**Query Parameters:**
- `name` (optional): Numele companiei
- `website` (optional): Website-ul companiei  
- `phone` (optional): Numarul de telefon
- `facebook` (optional): URL-ul Facebook


#### 6. **POST /api/companies/test**
Testeaza API-ul cu sample data din `API-input-sample.csv`.

**Request:**
POST http://localhost:3000/api/companies/test


**Response:**
```json
{
  "total_tests": 32,
  "successful_matches": 28,
  "match_rate": 87.5,
  "sample_results": [
    {
      "input": {
        "input_name": "SteppIR Tree Services",
        "input_website": "steppir.com",
        "input_phone": null,
        "input_facebook": "https://www.facebook.com/SteppIR/"
      },
      "match_found": true,
      "match_score": 0.95,
      "match_confidence": "high",
      "matched_fields": ["domain", "facebook"]
    }
    // ... 9 more sample results (primele 10)
  ]
}
```

#### 7. **GET /api/companies/test/full**
Returneaza rezultatele complete ale testelor (toate 32).

**Request:**
```bash
curl -X GET http://localhost:3000/api/companies/test/full
```

**Response:**
```json
{
  "total_tests": 32,
  "successful_matches": 28,
  "match_rate": 87.5,
  "results": [
    {
      "input": { /* input data */ },
      "match": { /* full match object cu company + match_score */ },
      "found": true
    }
    // ... toate 32 rezultate
  ]
}
```

#### 8. **GET /api/companies/debug/company/:domain**
Debug endpoint pentru a gasi o companie specifica dupa domain.

**Request:**
GET "http://localhost:3000/api/companies/debug/company/steppir.com"


#### 9. **GET /api/companies/debug/all**
Debug endpoint care returneaza primele 10 companii din dataset.

**Request:**
 GET http://localhost:3000/api/companies/debug/all


### Workflow Recomandat pentru Testing

#### Testare Completa Step-by-Step

```bash
# 1. Verifica ca aplicatia ruleaza
http://localhost:3000/api/companies/status

# 2. Porneste scraping-ul (dureaza ~8-10 minute)
POST http://localhost:3000/api/companies/scrape

# 3. Verifica analytics-urile
 http://localhost:3000/api/companies/analytics

# 4. Testeaza cu sample data
 POST http://localhost:3000/api/companies/test

# 5. Testeaza o cautare manuala
POST http://localhost:3000/api/companies/search \

  '{"name": "SteppIR", "website": "steppir.com"}'


### Note Importante
1. **Scraping Time:** Prima data cand rulezi `/scrape`, va dura 8-10 minute
2. **Error Handling:** API-ul returneaza error codes standard HTTP (404, 500)
3. **Data Format:** Toate response-urile sunt in JSON format