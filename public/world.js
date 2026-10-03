// Worldwide wire data for the fictional Mountain Hills network. Sample identifiers only.
(function (root) {
  const TYPES = { C: 'Commercial bank', S: 'Savings bank', O: 'Cooperative bank', U: 'Credit union', I: 'Investment bank', D: 'Digital bank', V: 'Development bank', P: 'Postal bank', M: 'Islamic bank', R: 'Private bank', N: 'Central bank' };
  // code: [name, currency, region, ibanLength (0 = local account), "Bank|T;Bank|T"]
  const C = {
    GB: ['United Kingdom', 'GBP', 'Europe', 22, 'Barclays|C;HSBC UK|C;Lloyds Bank|C;NatWest|C;Santander UK|C;Nationwide Building Society|S;Standard Chartered|C;Monzo|D;Starling Bank|D;Revolut Ltd|D;Metro Bank|C;Coventry Building Society|S;Hoare & Co|R;Bank of England|N'],
    DE: ['Germany', 'EUR', 'Europe', 22, 'Deutsche Bank|C;Commerzbank|C;DZ Bank|O;KfW|V;Sparkasse Berlin|S;Volksbank Mittelhessen|O;N26|D;Comdirect|D;ING Germany|C;UniCredit Bank (HypoVereinsbank)|C;Landesbank Baden-Wuerttemberg|C;Deutsche Bundesbank|N;Postbank|P'],
    FR: ['France', 'EUR', 'Europe', 27, 'BNP Paribas|C;Societe Generale|C;Credit Agricole|O;Banque Populaire|O;Caisse d\'Epargne|S;La Banque Postale|P;Credit Mutuel|O;LCL|C;Boursorama Banque|D;Natixis|I;Qonto|D;Banque de France|N'],
    ES: ['Spain', 'EUR', 'Europe', 24, 'Banco Santander|C;BBVA|C;CaixaBank|S;Banco Sabadell|C;Bankinter|C;Unicaja Banco|S;Abanca|C;Openbank|D;Kutxabank|S;Ibercaja|S;Banco de Espana|N'],
    IT: ['Italy', 'EUR', 'Europe', 27, 'UniCredit|C;Intesa Sanpaolo|C;Banco BPM|C;Monte dei Paschi di Siena|C;BPER Banca|C;Banca Mediolanum|C;Fineco Bank|D;Mediobanca|I;Poste Italiane|P;Credito Emiliano|C;Banca d\'Italia|N'],
    NL: ['Netherlands', 'EUR', 'Europe', 18, 'ING Bank|C;ABN AMRO|C;Rabobank|O;de Volksbank|S;Bunq|D;Triodos Bank|C;Knab|D;Van Lanschot Kempen|R;Nederlandsche Bank|N'],
    BE: ['Belgium', 'EUR', 'Europe', 16, 'KBC Bank|C;Belfius|C;BNP Paribas Fortis|C;ING Belgium|C;Argenta|S;AXA Bank Belgium|C;Beobank|C;Crelan|O'],
    IE: ['Ireland', 'EUR', 'Europe', 22, 'Bank of Ireland|C;AIB (Allied Irish Banks)|C;Permanent TSB|C;Ulster Bank Ireland|C;KBC Bank Ireland|C;An Post Money|P;Revolut Bank UAB (Ireland)|D;Credit Unions Ireland|U'],
    PT: ['Portugal', 'EUR', 'Europe', 25, 'Caixa Geral de Depositos|S;Millennium bcp|C;Novo Banco|C;Santander Totta|C;BPI|C;Banco CTT|P;Montepio|S;ActivoBank|D'],
    AT: ['Austria', 'EUR', 'Europe', 20, 'Erste Bank|S;Raiffeisen Bank International|O;Bank Austria|C;BAWAG|C;Oberbank|C;Volksbank Wien|O;Hello bank!|D;Schoellerbank|R'],
    FI: ['Finland', 'EUR', 'Europe', 18, 'Nordea Finland|C;OP Financial Group|O;Danske Bank Finland|C;S-Pankki|C;Handelsbanken Finland|C;Aktia Bank|C;Saastopankki|S;Oma Saastopankki|S'],
    GR: ['Greece', 'EUR', 'Europe', 27, 'National Bank of Greece|C;Piraeus Bank|C;Eurobank|C;Alpha Bank|C;Attica Bank|C;Hellenic Postbank|P'],
    LU: ['Luxembourg', 'EUR', 'Europe', 20, 'Banque et Caisse d\'Epargne de l\'Etat|S;BGL BNP Paribas|C;Banque Internationale a Luxembourg|C;Raiffeisen Luxembourg|O;Quintet Private Bank|R'],
    MT: ['Malta', 'EUR', 'Europe', 31, 'Bank of Valletta|C;HSBC Bank Malta|C;APS Bank|C;BNF Bank|C;Lombard Bank|C'],
    CY: ['Cyprus', 'EUR', 'Europe', 28, 'Bank of Cyprus|C;Hellenic Bank|C;Eurobank Cyprus|C;Astrobank|C;Cooperative Central Bank|O'],
    SK: ['Slovakia', 'EUR', 'Europe', 24, 'Slovenska sporitelna|S;VUB Banka|C;Tatra banka|C;CSOB Slovakia|C;Postova banka|P'],
    SI: ['Slovenia', 'EUR', 'Europe', 19, 'NLB|C;Nova KBM|C;SKB Banka|C;Abanka|C;Delavska hranilnica|S'],
    EE: ['Estonia', 'EUR', 'Europe', 20, 'Swedbank Estonia|C;SEB Estonia|C;LHV Pank|C;Coop Pank|O;Luminor Estonia|C'],
    LV: ['Latvia', 'EUR', 'Europe', 21, 'Swedbank Latvia|C;SEB Latvia|C;Citadele banka|C;Luminor Latvia|C;Rietumu Banka|C'],
    LT: ['Lithuania', 'EUR', 'Europe', 20, 'Swedbank Lithuania|C;SEB Lithuania|C;Luminor Lithuania|C;Siauliu bankas|C;Revolut Bank UAB|D'],
    HR: ['Croatia', 'EUR', 'Europe', 21, 'Zagrebacka banka|C;Privredna banka Zagreb|C;Erste Bank Croatia|C;OTP banka|C;Hrvatska postanska banka|P'],
    CH: ['Switzerland', 'CHF', 'Europe', 21, 'UBS|C;Credit Suisse Legacy (UBS)|C;Julius Baer|R;Zurcher Kantonalbank|S;PostFinance|P;Raiffeisen Switzerland|O;Lombard Odier|R;Pictet|R;Swiss National Bank|N;Migros Bank|C'],
    SE: ['Sweden', 'SEK', 'Europe', 24, 'Swedbank|C;SEB|C;Handelsbanken|C;Nordea Sweden|C;Danske Bank Sweden|C;Lansforsakringar Bank|C;Klarna Bank|D;Sveriges Riksbank|N'],
    NO: ['Norway', 'NOK', 'Europe', 15, 'DNB|C;Nordea Norway|C;SpareBank 1|S;Handelsbanken Norway|C;Sbanken|D;Danske Bank Norway|C;Storebrand Bank|C'],
    DK: ['Denmark', 'DKK', 'Europe', 18, 'Danske Bank|C;Nordea Denmark|C;Jyske Bank|C;Sydbank|C;Nykredit|C;Lunar|D;Spar Nord|C;Arbejdernes Landsbank|C'],
    IS: ['Iceland', 'ISK', 'Europe', 26, 'Landsbankinn|C;Islandsbanki|C;Arion Bank|C;Kvika Bank|I;Indo Bank|C'],
    PL: ['Poland', 'PLN', 'Europe', 28, 'PKO Bank Polski|C;Bank Pekao|C;mBank|D;ING Bank Slaski|C;Santander Bank Polska|C;Bank Millennium|C;Alior Bank|C;BNP Paribas Bank Polska|C;Credit Agricole Polska|C'],
    CZ: ['Czechia', 'CZK', 'Europe', 24, 'Ceska sporitelna|S;CSOB|C;Komercni banka|C;Raiffeisenbank CZ|C;Moneta Money Bank|C;Air Bank|D;Fio banka|C;UniCredit Bank CZ|C'],
    HU: ['Hungary', 'HUF', 'Europe', 28, 'OTP Bank|C;K&H Bank|C;Erste Bank Hungary|C;UniCredit Bank Hungary|C;MBH Bank|C;CIB Bank|C;Raiffeisen Bank Hungary|C'],
    RO: ['Romania', 'RON', 'Europe', 24, 'Banca Transilvania|C;BRD Groupe Societe Generale|C;Banca Comerciala Romana|C;Raiffeisen Bank Romania|C;ING Bank Romania|C;CEC Bank|S;UniCredit Bank Romania|C'],
    BG: ['Bulgaria', 'BGN', 'Europe', 22, 'UniCredit Bulbank|C;DSK Bank|C;First Investment Bank|C;Postbank Bulgaria|P;Raiffeisenbank Bulgaria|C;United Bulgarian Bank|C'],
    UA: ['Ukraine', 'UAH', 'Europe', 29, 'PrivatBank|C;Monobank|D;Oschadbank|S;Raiffeisen Bank Ukraine|C;Ukrgasbank|C;Pumb|C;Sense Bank|C'],
    TR: ['Turkiye', 'TRY', 'Europe', 26, 'Ziraat Bankasi|C;Is Bankasi|C;Garanti BBVA|C;Akbank|C;Yapi Kredi|C;Halkbank|C;VakifBank|C;QNB Finansbank|C;Enpara|D;Kuveyt Turk|M'],
    GE: ['Georgia', 'GEL', 'Europe', 22, 'Bank of Georgia|C;TBC Bank|C;Liberty Bank|C;Basisbank|C;Credo Bank|C'],
    AE: ['United Arab Emirates', 'AED', 'Middle East', 23, 'Emirates NBD|C;First Abu Dhabi Bank|C;Abu Dhabi Commercial Bank|C;Dubai Islamic Bank|M;Mashreq|C;RAKBANK|C;Emirates Islamic|M;Wio Bank|D;Liv.|D'],
    SA: ['Saudi Arabia', 'SAR', 'Middle East', 24, 'Saudi National Bank|C;Al Rajhi Bank|M;Riyad Bank|C;Banque Saudi Fransi|C;Saudi Awwal Bank|C;Alinma Bank|M;STC Bank|D'],
    QA: ['Qatar', 'QAR', 'Middle East', 29, 'Qatar National Bank|C;Commercial Bank of Qatar|C;Doha Bank|C;Qatar Islamic Bank|M;Masraf Al Rayan|M'],
    KW: ['Kuwait', 'KWD', 'Middle East', 30, 'National Bank of Kuwait|C;Kuwait Finance House|M;Gulf Bank|C;Burgan Bank|C;Warba Bank|M'],
    BH: ['Bahrain', 'BHD', 'Middle East', 22, 'National Bank of Bahrain|C;Bank of Bahrain and Kuwait|C;Ahli United Bank|C;Bahrain Islamic Bank|M'],
    JO: ['Jordan', 'JOD', 'Middle East', 30, 'Arab Bank|C;Housing Bank for Trade and Finance|C;Bank al Etihad|C;Jordan Islamic Bank|M;Cairo Amman Bank|C'],
    IL: ['Israel', 'ILS', 'Middle East', 23, 'Bank Hapoalim|C;Bank Leumi|C;Israel Discount Bank|C;Mizrahi-Tefahot|C;First International Bank of Israel|C;Bank Yahav|C'],
    EG: ['Egypt', 'EGP', 'Africa', 29, 'National Bank of Egypt|C;Banque Misr|C;Commercial International Bank|C;QNB Alahli|C;Banque du Caire|C;Faisal Islamic Bank|M'],
    MA: ['Morocco', 'MAD', 'Africa', 28, 'Attijariwafa Bank|C;Banque Populaire|O;Bank of Africa|C;BMCI|C;CIH Bank|C;Credit Agricole du Maroc|C'],
    ZA: ['South Africa', 'ZAR', 'Africa', 0, 'Standard Bank|C;FirstRand (FNB)|C;Absa Bank|C;Nedbank|C;Capitec Bank|C;Investec|I;TymeBank|D;Discovery Bank|D;African Bank|C'],
    NG: ['Nigeria', 'NGN', 'Africa', 0, 'Access Bank|C;Zenith Bank|C;GTBank|C;First Bank of Nigeria|C;UBA|C;Stanbic IBTC|C;Fidelity Bank|C;Wema Bank|C;Kuda|D;Opay|D'],
    KE: ['Kenya', 'KES', 'Africa', 0, 'Equity Bank|C;KCB Bank|C;Co-operative Bank of Kenya|O;Absa Bank Kenya|C;Stanbic Kenya|C;NCBA Bank|C;Family Bank|C'],
    GH: ['Ghana', 'GHS', 'Africa', 0, 'GCB Bank|C;Ecobank Ghana|C;Stanbic Ghana|C;Absa Ghana|C;Fidelity Bank Ghana|C;CalBank|C'],
    US: null,
    CA: ['Canada', 'CAD', 'Americas', 0, 'Royal Bank of Canada|C;TD Canada Trust|C;Scotiabank|C;Bank of Montreal|C;CIBC|C;National Bank of Canada|C;Desjardins|U;Tangerine|D;EQ Bank|D;Simplii Financial|D;Vancity|U'],
    MX: ['Mexico', 'MXN', 'Americas', 0, 'BBVA Mexico|C;Banorte|C;Santander Mexico|C;Citibanamex|C;HSBC Mexico|C;Scotiabank Mexico|C;Nu Mexico|D;Banco Azteca|C'],
    BR: ['Brazil', 'BRL', 'Americas', 29, 'Itau Unibanco|C;Banco do Brasil|C;Bradesco|C;Caixa Economica Federal|S;Santander Brasil|C;BTG Pactual|I;Nubank|D;Banco Inter|D;C6 Bank|D;Sicredi|O'],
    AR: ['Argentina', 'ARS', 'Americas', 0, 'Banco Nacion|C;Banco Galicia|C;Banco Santander Argentina|C;BBVA Argentina|C;Banco Macro|C;Mercado Pago|D'],
    CL: ['Chile', 'CLP', 'Americas', 0, 'Banco de Chile|C;Banco Santander Chile|C;BCI|C;BancoEstado|C;Scotiabank Chile|C;Itau Chile|C'],
    CO: ['Colombia', 'COP', 'Americas', 0, 'Bancolombia|C;Banco de Bogota|C;Davivienda|C;BBVA Colombia|C;Banco Popular|C;Nequi|D'],
    PE: ['Peru', 'PEN', 'Americas', 0, 'Banco de Credito del Peru|C;BBVA Peru|C;Interbank|C;Scotiabank Peru|C;Banco de la Nacion|C'],
    JP: ['Japan', 'JPY', 'Asia-Pacific', 0, 'MUFG Bank|C;Sumitomo Mitsui Banking|C;Mizuho Bank|C;Resona Bank|C;SBI Shinsei Bank|C;Rakuten Bank|D;Japan Post Bank|P;Nomura|I;Sony Bank|D;Norinchukin Bank|O'],
    CN: ['China', 'CNY', 'Asia-Pacific', 0, 'ICBC|C;China Construction Bank|C;Agricultural Bank of China|C;Bank of China|C;Bank of Communications|C;China Merchants Bank|C;Postal Savings Bank of China|P;WeBank|D;Ping An Bank|C'],
    HK: ['Hong Kong', 'HKD', 'Asia-Pacific', 0, 'HSBC Hong Kong|C;Hang Seng Bank|C;Bank of China (Hong Kong)|C;Standard Chartered HK|C;ZA Bank|D;Mox Bank|D;BEA|C'],
    SG: ['Singapore', 'SGD', 'Asia-Pacific', 0, 'DBS Bank|C;OCBC Bank|C;United Overseas Bank|C;Standard Chartered Singapore|C;Maybank Singapore|C;GXS Bank|D;Trust Bank|D;POSB|S'],
    IN: ['India', 'INR', 'Asia-Pacific', 0, 'State Bank of India|C;HDFC Bank|C;ICICI Bank|C;Axis Bank|C;Kotak Mahindra Bank|C;Punjab National Bank|C;Bank of Baroda|C;IDFC First Bank|C;Yes Bank|C;India Post Payments Bank|P'],
    PK: ['Pakistan', 'PKR', 'Asia-Pacific', 24, 'Habib Bank|C;United Bank Limited|C;MCB Bank|C;Allied Bank|C;Meezan Bank|M;Bank Alfalah|C;Faysal Bank|M'],
    KR: ['South Korea', 'KRW', 'Asia-Pacific', 0, 'KB Kookmin Bank|C;Shinhan Bank|C;Hana Bank|C;Woori Bank|C;NongHyup Bank|O;KakaoBank|D;Toss Bank|D;IBK|V'],
    TW: ['Taiwan', 'TWD', 'Asia-Pacific', 0, 'CTBC Bank|C;Cathay United Bank|C;E.SUN Bank|C;Taishin Bank|C;Fubon Bank|C;Chunghwa Post|P'],
    TH: ['Thailand', 'THB', 'Asia-Pacific', 0, 'Bangkok Bank|C;Kasikornbank|C;Siam Commercial Bank|C;Krungthai Bank|C;Bank of Ayudhya (Krungsri)|C;TMBThanachart|C;Government Savings Bank|S'],
    MY: ['Malaysia', 'MYR', 'Asia-Pacific', 0, 'Maybank|C;CIMB Bank|C;Public Bank|C;RHB Bank|C;Hong Leong Bank|C;Bank Islam|M;AmBank|C;GXBank|D'],
    ID: ['Indonesia', 'IDR', 'Asia-Pacific', 0, 'Bank Central Asia|C;Bank Mandiri|C;Bank Rakyat Indonesia|C;Bank Negara Indonesia|C;CIMB Niaga|C;Bank Syariah Indonesia|M;Jago|D'],
    PH: ['Philippines', 'PHP', 'Asia-Pacific', 0, 'BDO Unibank|C;Bank of the Philippine Islands|C;Metrobank|C;Land Bank of the Philippines|V;Security Bank|C;UnionBank|C;GCash (Mynt)|D'],
    VN: ['Vietnam', 'VND', 'Asia-Pacific', 0, 'Vietcombank|C;BIDV|C;VietinBank|C;Techcombank|C;MB Bank|C;VPBank|C;ACB|C'],
    AU: ['Australia', 'AUD', 'Asia-Pacific', 0, 'Commonwealth Bank|C;Westpac|C;ANZ|C;National Australia Bank|C;Macquarie Bank|I;Bendigo Bank|C;ING Australia|D;Up Bank|D;Great Southern Bank|U;Reserve Bank of Australia|N'],
    NZ: ['New Zealand', 'NZD', 'Asia-Pacific', 0, 'ANZ New Zealand|C;ASB Bank|C;BNZ|C;Westpac NZ|C;Kiwibank|C;TSB Bank|C;Heartland Bank|C']
  };
  const countries = Object.entries(C).filter(([, v]) => v).map(([code, v]) => ({ code, name: v[0], currency: v[1], region: v[2], iban: v[3], banks: v[4].split(';').map(s => { const [name, t] = s.split('|'); return { name, type: TYPES[t] || 'Commercial bank' }; }) })).sort((a, b) => a.name.localeCompare(b.name));
  // Sample mid-market rates per 1 USD. Live rates replace these when available.
  const RATES = { EUR: .92, GBP: .78, CHF: .88, SEK: 10.4, NOK: 10.6, DKK: 6.9, ISK: 138, PLN: 3.95, CZK: 23, HUF: 360, RON: 4.6, BGN: 1.8, UAH: 41, TRY: 34, GEL: 2.7, AED: 3.6725, SAR: 3.75, QAR: 3.64, KWD: .307, BHD: .376, JOD: .709, ILS: 3.7, EGP: 49, MAD: 9.9, ZAR: 18, NGN: 1600, KES: 129, GHS: 15, CAD: 1.36, MXN: 18, BRL: 5.5, ARS: 950, CLP: 930, COP: 4100, PEN: 3.75, JPY: 148, CNY: 7.15, HKD: 7.8, SGD: 1.33, INR: 83.5, PKR: 278, KRW: 1350, TWD: 32, THB: 35, MYR: 4.5, IDR: 15800, PHP: 57, VND: 25000, AUD: 1.5, NZD: 1.65, USD: 1 };
  const ZERO_DEC = ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'ISK', 'HUF'];
  const SYM = { EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', KRW: '₩', CHF: 'CHF ', AUD: 'A$', CAD: 'C$', NZD: 'NZ$', SGD: 'S$', HKD: 'HK$', MXN: 'MX$', BRL: 'R$', ZAR: 'R ', NGN: '₦', TRY: '₺', ILS: '₪', USD: '$' };
  const flag = cc => String.fromCodePoint(...[...cc].map(c => 127397 + c.charCodeAt(0)));
  const bic = (name, cc) => { const l = name.replace(/[^A-Za-z]/g, '').toUpperCase().padEnd(4, 'X').slice(0, 4); let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return l + cc + (h.toString(36).toUpperCase() + 'XX').slice(0, 2) + (h % 3 ? 'XXX' : ''); };
  const bicOk = v => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(v || '').toUpperCase());
  const mod97 = s => { let r = 0; for (const ch of s) { const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55); for (const d of v) r = (r * 10 + Number(d)) % 97; } return r; };
  const ibanOk = (v, cc) => { const s = String(v || '').replace(/\s+/g, '').toUpperCase(), c = C[cc]; if (!c || !c[3]) return /^[A-Z0-9]{6,30}$/.test(s); return s.length === c[3] && s.startsWith(cc) && /^[A-Z0-9]+$/.test(s) && mod97(s.slice(4) + s.slice(0, 4)) === 1; };
  const sampleIban = (cc, seed) => { const c = C[cc]; if (!c || !c[3]) return ''; let body = ''; let h = (seed || 1234567) >>> 0; while (body.length < c[3] - 4) { h = (h * 1103515245 + 12345) >>> 0; body += String(h % 10); } const chk = 98 - mod97(body + cc.split('').map(x => x.charCodeAt(0) - 55).join('') + '00'); return cc + String(chk).padStart(2, '0') + body; };
  const api = { TYPES, countries, RATES, ZERO_DEC, SYM, flag, bic, bicOk, ibanOk, sampleIban, byCode: cc => countries.find(c => c.code === cc) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MH_WORLD = api;
})(typeof window !== 'undefined' ? window : globalThis);
