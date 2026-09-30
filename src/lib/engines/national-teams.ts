export type NationalTeam = {
  keys: string[];
  official: string;
  code: string;
  flag: string;
};

const TABLE = `
afghanistan | Afganistán | AFG | af
albania | Albania | ALB | al
algeria | Argelia | ALG | dz
american samoa | Samoa Americana | ASA | as
andorra | Andorra | AND | ad
angola | Angola | ANG | ao
anguilla | Anguila | AIA | ai
antigua and barbuda | Antigua y Barbuda | ATG | ag
argentina | Argentina | ARG | ar
armenia | Armenia | ARM | am
aruba | Aruba | ARU | aw
australia | Australia | AUS | au
austria | Austria | AUT | at
azerbaijan | Azerbaiyán | AZE | az
bahamas | Bahamas | BAH | bs
bahrain | Baréin | BHR | bh
bangladesh | Bangladesh | BAN | bd
barbados | Barbados | BRB | bb
belarus | Bielorrusia | BLR | by
belgium | Bélgica | BEL | be
belize | Belice | BLZ | bz
benin | Benín | BEN | bj
bermuda | Bermudas | BER | bm
bhutan | Bután | BHU | bt
bolivia | Bolivia | BOL | bo
bosnia, bosnia herzegovina, bosnia and herzegovina | Bosnia | BIH | ba
botswana | Botsuana | BOT | bw
brazil | Brasil | BRA | br
british virgin islands | Islas Vírgenes Británicas | VGB | vg
brunei, brunei darussalam | Brunéi | BRU | bn
bulgaria | Bulgaria | BUL | bg
burkina faso | Burkina Faso | BFA | bf
burundi | Burundi | BDI | bi
cambodia | Camboya | CAM | kh
cameroon | Camerún | CMR | cm
canada | Canadá | CAN | ca
cape verde, cape verde islands | Cabo Verde | CPV | cv
cayman islands | Islas Caimán | CAY | ky
central african republic | República Centroafricana | CTA | cf
chad | Chad | CHA | td
chile | Chile | CHI | cl
china | China | CHN | cn
chinese taipei, taiwan | China Taipéi | TPE | tw
colombia | Colombia | COL | co
comoros | Comoras | COM | km
congo | Congo | CGO | cg
congo dr, dr congo | RD del Congo | COD | cd
cook islands | Islas Cook | COK | ck
costa rica | Costa Rica | CRC | cr
croatia | Croacia | CRO | hr
cuba | Cuba | CUB | cu
curacao | Curazao | CUW | cw
cyprus | Chipre | CYP | cy
czechia, czech republic | Chequia | CZE | cz
denmark | Dinamarca | DEN | dk
djibouti | Yibuti | DJI | dj
dominica | Dominica | DMA | dm
dominican republic | República Dominicana | DOM | do
ecuador | Ecuador | ECU | ec
egypt | Egipto | EGY | eg
el salvador | El Salvador | SLV | sv
england | Inglaterra | ENG | gb-eng
equatorial guinea | Guinea Ecuatorial | EQG | gq
eritrea | Eritrea | ERI | er
estonia | Estonia | EST | ee
eswatini, swaziland | Esuatini | SWZ | sz
ethiopia | Etiopía | ETH | et
faroe islands | Islas Feroe | FRO | fo
fiji | Fiyi | FIJ | fj
finland | Finlandia | FIN | fi
france | Francia | FRA | fr
french guiana | Guayana Francesa | GUF | gf
gabon | Gabón | GAB | ga
gambia | Gambia | GAM | gm
georgia | Georgia | GEO | ge
germany | Alemania | GER | de
ghana | Ghana | GHA | gh
gibraltar | Gibraltar | GIB | gi
greece | Grecia | GRE | gr
grenada | Granada | GRN | gd
guadeloupe | Guadalupe | GLP | gp
guam | Guam | GUM | gu
guatemala | Guatemala | GUA | gt
guinea | Guinea | GUI | gn
guinea bissau | Guinea-Bisáu | GNB | gw
guyana | Guyana | GUY | gy
haiti | Haití | HAI | ht
honduras | Honduras | HON | hn
hong kong | Hong Kong | HKG | hk
hungary | Hungría | HUN | hu
iceland | Islandia | ISL | is
india | India | IND | in
indonesia | Indonesia | IDN | id
iran | Irán | IRN | ir
iraq | Irak | IRQ | iq
ireland, republic of ireland, rep of ireland | Irlanda | IRL | ie
israel | Israel | ISR | il
italy | Italia | ITA | it
ivory coast, cote d ivoire | Costa de Marfil | CIV | ci
jamaica | Jamaica | JAM | jm
japan | Japón | JPN | jp
jordan | Jordania | JOR | jo
kazakhstan | Kazajistán | KAZ | kz
kenya | Kenia | KEN | ke
kosovo | Kosovo | KOS | xk
kuwait | Kuwait | KUW | kw
kyrgyzstan | Kirguistán | KGZ | kg
laos | Laos | LAO | la
latvia | Letonia | LVA | lv
lebanon | Líbano | LBN | lb
lesotho | Lesoto | LES | ls
liberia | Liberia | LBR | lr
libya | Libia | LBY | ly
liechtenstein | Liechtenstein | LIE | li
lithuania | Lituania | LTU | lt
luxembourg | Luxemburgo | LUX | lu
macau, macao | Macao | MAC | mo
madagascar | Madagascar | MAD | mg
malawi | Malaui | MWI | mw
malaysia | Malasia | MAS | my
maldives | Maldivas | MDV | mv
mali | Malí | MLI | ml
malta | Malta | MLT | mt
martinique | Martinica | MTQ | mq
mauritania | Mauritania | MTN | mr
mauritius | Mauricio | MRI | mu
mexico, seleccion mexicana | México | MEX | mx
moldova | Moldavia | MDA | md
mongolia | Mongolia | MNG | mn
montenegro | Montenegro | MNE | me
montserrat | Montserrat | MSR | ms
morocco | Marruecos | MAR | ma
mozambique | Mozambique | MOZ | mz
myanmar, burma | Myanmar | MYA | mm
namibia | Namibia | NAM | na
nepal | Nepal | NEP | np
netherlands, holland | Holanda | NED | nl
new caledonia | Nueva Caledonia | NCL | nc
new zealand | Nueva Zelanda | NZL | nz
nicaragua | Nicaragua | NCA | ni
niger | Níger | NIG | ne
nigeria | Nigeria | NGA | ng
north korea, korea dpr | Corea del Norte | PRK | kp
north macedonia, macedonia, fyr macedonia | Macedonia | MKD | mk
northern ireland | Irlanda del Norte | NIR | gb-nir
norway | Noruega | NOR | no
oman | Omán | OMA | om
pakistan | Pakistán | PAK | pk
palestine | Palestina | PLE | ps
panama | Panamá | PAN | pa
papua new guinea | Papúa Nueva Guinea | PNG | pg
paraguay | Paraguay | PAR | py
peru | Perú | PER | pe
philippines | Filipinas | PHI | ph
poland | Polonia | POL | pl
portugal | Portugal | POR | pt
puerto rico | Puerto Rico | PUR | pr
qatar | Catar | QAT | qa
romania | Rumania | ROU | ro
russia | Rusia | RUS | ru
rwanda | Ruanda | RWA | rw
saint kitts and nevis | San Cristóbal y Nieves | SKN | kn
saint lucia | Santa Lucía | LCA | lc
saint vincent and the grenadines | San Vicente y las Granadinas | VIN | vc
samoa | Samoa | SAM | ws
san marino | San Marino | SMR | sm
sao tome and principe | Santo Tomé y Príncipe | STP | st
saudi arabia | Arabia Saudita | KSA | sa
scotland | Escocia | SCO | gb-sct
senegal | Senegal | SEN | sn
serbia | Serbia | SRB | rs
seychelles | Seychelles | SEY | sc
sierra leone | Sierra Leona | SLE | sl
singapore | Singapur | SGP | sg
slovakia | Eslovaquia | SVK | sk
slovenia | Eslovenia | SVN | si
solomon islands | Islas Salomón | SOL | sb
somalia | Somalia | SOM | so
south africa | Sudáfrica | RSA | za
south korea, korea republic | Corea del Sur | KOR | kr
south sudan | Sudán del Sur | SSD | ss
spain | España | ESP | es
sri lanka | Sri Lanka | SRI | lk
sudan | Sudán | SDN | sd
suriname | Surinam | SUR | sr
sweden | Suecia | SWE | se
switzerland | Suiza | SUI | ch
syria | Siria | SYR | sy
tahiti | Tahití | TAH | pf
tajikistan | Tayikistán | TJK | tj
tanzania | Tanzania | TAN | tz
thailand | Tailandia | THA | th
timor leste, east timor | Timor Oriental | TLS | tl
togo | Togo | TOG | tg
tonga | Tonga | TGA | to
trinidad and tobago | Trinidad y Tobago | TRI | tt
tunisia | Túnez | TUN | tn
turkey, turkiye | Turquía | TUR | tr
turkmenistan | Turkmenistán | TKM | tm
turks and caicos islands | Islas Turcas y Caicos | TCA | tc
uganda | Uganda | UGA | ug
ukraine | Ucrania | UKR | ua
united arab emirates | Emiratos Árabes | UAE | ae
united states, usa | Estados Unidos | USA | us
uruguay | Uruguay | URU | uy
us virgin islands | Islas Vírgenes de Estados Unidos | VIR | vi
uzbekistan | Uzbekistán | UZB | uz
vanuatu | Vanuatu | VAN | vu
venezuela | Venezuela | VEN | ve
vietnam | Vietnam | VIE | vn
wales | Gales | WAL | gb-wls
yemen | Yemen | YEM | ye
zambia | Zambia | ZAM | zm
zimbabwe | Zimbabue | ZIM | zw
`.trim();

function normKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const NATIONAL_TEAMS: NationalTeam[] = TABLE.split("\n").map((line) => {
  const [rawKeys, official, code, flag] = line.split(" | ");
  return {
    keys: rawKeys.split(",").map((key) => normKey(key)),
    official: official.trim(),
    code: code.trim(),
    flag: flag.trim(),
  };
});

const seenKeys = new Set<string>();
const seenCodes = new Set<string>();
const seenNames = new Set<string>();
for (const team of NATIONAL_TEAMS) {
  if (seenNames.has(team.official) || seenCodes.has(team.code) || !/^[A-Z]{3}$/.test(team.code) || !/^[a-z0-9-]+$/.test(team.flag)) {
    throw new Error(`Selección mal armada: ${team.official}`);
  }
  seenNames.add(team.official);
  seenCodes.add(team.code);
  for (const key of team.keys) {
    if (!key || seenKeys.has(key)) throw new Error(`Llave repetida de selección: ${key}`);
    seenKeys.add(key);
  }
}
