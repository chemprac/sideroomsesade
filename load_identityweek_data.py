"""
load_identityweek_data.py

Loads Identity Week 2026 attendee CSV into Supabase.
- Upserts all attendees into the attendees table
- Derives unique companies and tags them (priority/shallow/skip)
- Upserts companies into the companies table

Run from project root:
  python3 load_identityweek_data.py

Requirements:
  pip3 install pandas supabase python-dotenv
"""

import os
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(".env.local")

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
EVENT_SLUG   = "identity-week-2026"
CSV_FILE = "IDENWEEKattendee - final list attendees.csv"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─────────────────────────────────────────────
# COMPANY NAME CONSOLIDATION
# Variants → canonical name
# ─────────────────────────────────────────────
CONSOLIDATION_MAP = {
    "ingroupe":                              "IN Groupe",
    "in groupe trust services":              "IN Groupe",
    "in groupe":                             "IN Groupe",
    "in groupe":                             "IN Groupe",
    "veridos netset ltd.":                   "Veridos",
    "veridos gmbh":                          "Veridos",
    "veridos matsoukis sa":                  "Veridos",
    "veridos gmbh - identity solutions by giesecke+devrient and bundesdruckerei": "Veridos",
    "ovd kinegram":                          "OVD Kinegram AG",
    "bundesdruckerei":                       "Bundesdruckerei GmbH",
    "toppan inc.":                           "TOPPAN Security",
    "toppan forms colombo ltd":              "TOPPAN Security",
    "hid global":                            "HID Global",
    "hid global switzerland s. a.":          "HID Global",
    "hid":                                   "HID Global",
    "thales uk":                             "Thales",
    "entrust":                               "Entrust",
    "sicpa sa":                              "SICPA",
    "luminescence sun chemical security":    "Luminescence",
    "luminescence international ltd":        "Luminescence",
    "luminescence scs":                      "Luminescence",
    "luminochem kft.":                       "Luminochem",
    "austrian state printing company - österreichische staatsdruckerei gmbh": "Austrian State Printing Company",
    "austrian state printing house":         "Austrian State Printing Company",
    "österreichische staatsdruckerei gmbh / austrian state printing house": "Austrian State Printing Company",
    "portals paper limited":                 "Portals Paper Ltd",
    "drewsen/portals paper":                 "Portals Paper Ltd",
    "polyvantis f&s b.v.":                   "POLYVANTIS",
    "get group holdings ltd.":               "Get Group",
    "get group holdings limited":            "Get Group",
    "get group north america":               "Get Group",
    "get groupe":                            "Get Group",
    "rotoflex ag":                           "Rotoflex",
    "cetis d.d.":                            "CETIS",
    "any security printing company plc":     "ANY Security Printing Company Plc.",
    "4plate":                                "4Plate GmbH",
    "iai industrial systems bv":             "IAI Industrial Systems B.V.",
    "iai | ixla":                            "IAI | IXLA",
    "ixla srl":                              "IAI | IXLA",
    "projectina ag":                         "Projectina",
    "feitian technologies co., ltd.":        "FEITIAN Technologies",
    "infineon technologies americas":        "INFINEON TECHNOLOGIES",
    "infineon technologies ag":              "INFINEON TECHNOLOGIES",
    "iq structures s\u22c5r.o.":             "IQ STRUCTURES",
    "jura jsp gmbh":                         "Jura",
    "delivery hero se":                      "Delivery Hero",
    "centro grafico dg":                     "Centro Grafico",
    "orell füssli ag":                       "Orell Füssli",
    "desko gmbh":                            "DESKO",
    "bw papersystems stuttgart gmbh":        "BW Papersystems",
    "pátria security printing house co.":    "Pátria Security Printing SC",
    "pitkit printing enterprise":            "Pitkit Printing Enterprises Ltd",
    "austriacard holding":                   "AUSTRIACARD",
    "linxens financière d":                  "Linxens",
    "diagramm halbach gmbh & co. kg":        "Diagramm Halbach",
    "abn amro bank":                         "ABN AMRO",
    "abn amro":                              "ABN AMRO",
}

# ─────────────────────────────────────────────
# GOV / LAW ENFORCEMENT EXCLUSION
# ─────────────────────────────────────────────
GOV_KEYWORDS = [
    'police', 'marechaussee', 'ministry', 'ministerie', 'government',
    'gemeente', 'municipal', 'border force', 'migration', 'bundespolizei',
    'polizei', 'gendarmerie', 'prefect', 'carabinieri', 'guardia civil',
    'homeland', 'immigration', 'customs', 'interpol', 'europol', 'frontex',
    'dvla', 'home office', 'home affairs', 'judiciary', 'state border',
    'federal police', 'national police', 'iom ', 'hadea', 'municipality',
    'consulate', 'embassy', 'department of', 'bureau of', 'tribunal',
    'correctional', 'prison', 'defence', 'defense', 'military',
    'armed forces', 'nato', 'intelligence service', 'national office for',
    'public services agency', 'anticorruption', 'civil aviation',
    'rijksdienst', 'belastingdienst', 'sociale verzekering', 'city of ',
    'kmar', ' ind ', 'rvig',
]

def is_gov(company: str) -> bool:
    if not company or pd.isna(company):
        return False
    return any(k in company.lower() for k in GOV_KEYWORDS)

def consolidate(company: str) -> str:
    if not company or pd.isna(company):
        return company
    return CONSOLIDATION_MAP.get(company.lower().strip(), company.strip())

# ─────────────────────────────────────────────
# PRIORITY COMPANY KEYWORDS
# ─────────────────────────────────────────────
PRIORITY_KEYWORDS = [
    # Security printers / document manufacturers
    'in groupe', 'bundesdruckerei', 'toppan', 'veridos', 'crane',
    'austrian state printing', 'cetis', 'any security printing',
    'polish security printing', 'hungarian banknote', 'banknote corporation',
    'orell', 'portals paper', 'radece papir', 'landqart', 'louisenthal',
    'cartor', 'bn international', 'oberthur', 'pátria', 'pitkit',
    'apo production', 'centro grafico', 'signe', 'bw papersystems',
    'andrews and wykeham', 'diagramm halbach', 'get group', 'paragon id',
    'mülhbauer', 'mulhbauer', 'jura', 'austriacard', 'rotoflex',
    # Security inks / pigments / materials
    'sicpa', 'luminescence', 'luminochem', 'proell', 'printcolor',
    'covestro', 'polyvantis', 'iq structures', 'nanosilikhan',
    'quantum base', 'demax holograms', 'linxens', 'itw specialty',
    'huizhou foryou', 'jiangsu zhenzhen', 'xinou material', 'suzhou image',
    'markland', 'tegona', '4plate',
    # Semiconductors / chips
    'nxp', 'infineon', 'stmicro', 'feitian', 'exceet',
    # Document inspection / authentication
    'keesing', 'ovd kinegram', 'iai', 'ixla', 'projectina', 'piotec',
    'adaptive recognition', 'lake image', 'desko', 'regula', 'scandoc',
    'x infotech', 'han laser', 'seaory',
    # Pilot customers
    'pfizer', 'roche', 'nala cosmetics', 'delivery hero', 'liberty threads',
    # Major identity vendors
    'entrust', 'hid', 'thales', 'zetes', 'idemia', 'tinexta',
    'docaposte', 'eviden', 'speed identity', 'lace', 'meremus',
]

def get_tier(company: str, gov: bool) -> str:
    if gov:
        return 'skip'
    if not company or pd.isna(company):
        return 'shallow'
    c = company.lower()
    if any(k in c for k in PRIORITY_KEYWORDS):
        return 'priority'
    return 'shallow'

# ─────────────────────────────────────────────
# 1. LOAD CSV
# ─────────────────────────────────────────────
print("=" * 60)
print("Identity Week 2026 — Data Loader")
print("=" * 60)

print(f"\nReading {CSV_FILE}...")
df = pd.read_csv(CSV_FILE)
df.columns = ['name', 'company_raw', 'col2', 'col3', 'col4']
df = df[['name', 'company_raw']].copy()

df['name']        = df['name'].str.strip()
df['company_raw'] = df['company_raw'].str.strip()

# Remove junk rows
junk = ['ik moet', 'partnership loji', 'belangerijk']
df = df[~df['name'].str.lower().str.contains('|'.join(junk), na=False)]
df = df[df['name'].notna() & df['company_raw'].notna()]

# Deduplicate
before = len(df)
df = df.drop_duplicates(subset=['name', 'company_raw'])
print(f"  Removed {before - len(df)} duplicate rows")

# Consolidate + tag
df['company']         = df['company_raw'].apply(consolidate)
df['is_gov']          = df['company'].apply(is_gov)
df['enrichment_tier'] = df.apply(lambda r: get_tier(r['company'], r['is_gov']), axis=1)

print(f"  Total attendees: {len(df)}")
print(f"  Gov/skip:        {(df['enrichment_tier'] == 'skip').sum()}")
print(f"  Priority:        {(df['enrichment_tier'] == 'priority').sum()}")
print(f"  Shallow:         {(df['enrichment_tier'] == 'shallow').sum()}")

# ─────────────────────────────────────────────
# 2. UPSERT ATTENDEES
# ─────────────────────────────────────────────
print(f"\nUpserting attendees...")
attendee_rows = []
for _, row in df.iterrows():
    attendee_rows.append({
        "event_slug":       EVENT_SLUG,
        "name":             row['name'],
        "company":          row['company'],
        "is_gov":           bool(row['is_gov']),
        "enrichment_tier":  row['enrichment_tier'],
    })

BATCH = 200
success = 0
for i in range(0, len(attendee_rows), BATCH):
    batch = attendee_rows[i:i+BATCH]
    try:
        supabase.table("attendees").upsert(
    batch
).execute()
        success += len(batch)
        print(f"  Upserted {min(i+BATCH, len(attendee_rows))}/{len(attendee_rows)}...")
    except Exception as e:
        print(f"  ERROR on batch {i}: {e}")

print(f"  Done. {success} attendees upserted.")

# ─────────────────────────────────────────────
# 3. DERIVE + UPSERT COMPANIES
# ─────────────────────────────────────────────
print(f"\nDeriving unique companies...")

company_summary = (
    df.groupby('company')
    .agg(
        attendee_count=('name', 'count'),
        is_gov=('is_gov', 'first'),
        enrichment_tier=('enrichment_tier', 'first'),
    )
    .reset_index()
    .sort_values('attendee_count', ascending=False)
)

print(f"  Unique companies: {len(company_summary)}")
print(f"  Priority:         {(company_summary['enrichment_tier'] == 'priority').sum()}")
print(f"  Shallow:          {(company_summary['enrichment_tier'] == 'shallow').sum()}")
print(f"  Skip (gov):       {(company_summary['enrichment_tier'] == 'skip').sum()}")

print(f"\nUpserting companies...")
company_rows = []
for _, row in company_summary.iterrows():
    company_rows.append({
        "event_slug":      EVENT_SLUG,
        "name":            row['company'],
        "enrichment_tier": row['enrichment_tier'],
        "attendee_count":  int(row['attendee_count']),
        "is_gov":          bool(row['is_gov']),
    })

success = 0
for i in range(0, len(company_rows), BATCH):
    batch = company_rows[i:i+BATCH]
    try:
        supabase.table("companies").upsert(
            batch,
            on_conflict="name,event_slug"
        ).execute()
        success += len(batch)
        print(f"  Upserted {min(i+BATCH, len(company_rows))}/{len(company_rows)}...")
    except Exception as e:
        print(f"  ERROR on batch {i}: {e}")

print(f"  Done. {success} companies upserted.")

# ─────────────────────────────────────────────
# 4. EXPORT PRIORITY LIST FOR REFERENCE
# ─────────────────────────────────────────────
priority = company_summary[company_summary['enrichment_tier'] == 'priority']
priority[['company', 'attendee_count']].to_csv(
    "identity_week_priority_companies.csv", index=False
)

print(f"\n{'=' * 60}")
print("COMPLETE")
print(f"  Attendees loaded:        {len(df)}")
print(f"  Companies loaded:        {len(company_summary)}")
print(f"  Priority to enrich:      {len(priority)}")
print(f"  Priority list saved to:  identity_week_priority_companies.csv")
print()
print("Next step:")
print("  python3 enrich_identity_week_companies.py --test")
print("=" * 60)
