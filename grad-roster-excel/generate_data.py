import random
import unicodedata

from faker import Faker

from create_grad_roster import build_workbook

ROW_COUNT = 2000

# Within each industry's company list, the first `len(companies) // ANCHOR_FRACTION`
# companies (already ordered by recognizability, e.g. McKinsey/BCG/Bain first in
# Consulting) are "anchor" employers that absorb most of that industry's alumni —
# mimics real alumni-network pipeline effects and gives the company bubble chart a
# handful of big, meaningful bubbles instead of a flat long tail.
ANCHOR_FRACTION = 3
ANCHOR_WEIGHT = 8
NON_ANCHOR_WEIGHT = 1

GRAD_YEARS = list(range(2019, 2026))

CLUSTERS = ["A", "B", "C", "D", "E", "F"]
CLUSTER_WEIGHTS = [16, 16, 16, 16, 16, 10]
J_TERM_LABEL = "X"

# Columns A-M (0-indexed 0-12): blank values become "#N/A".
# Columns N-P (0-indexed 13-15, State/Country/Dual Degree): blanks stay blank.
NA_PLACEHOLDER_COLUMN_COUNT = 13
NA_PLACEHOLDER = "#N/A"

STATUS_OPTIONS = [
    "Employed",
    "Not seeking",
    "Returning to sponsoring company or previous employer",
    "Starting a new business",
]
STATUS_WEIGHTS = [72, 10, 12, 6]

# Curated romanized name pools for countries where Faker's native-locale
# provider returns non-Latin script (Chinese, Korean, Japanese) or has no
# locale (Nigeria, UAE, Singapore).
NAME_POOLS = {
    "China": (
        ["Wei", "Jing", "Ming", "Xin", "Lei", "Hui", "Fang", "Yan", "Jun", "Tao",
         "Mei", "Chen", "Li", "Yue", "Bo"],
        ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu", "Zhou"],
    ),
    "South Korea": (
        ["Ji-hoon", "Min-jun", "Seo-yeon", "Ha-eun", "Jun-ho", "Yuna", "Soo-jin",
         "Dong-hyun", "Eun-ji", "Hyun-woo"],
        ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim"],
    ),
    "Japan": (
        ["Haruto", "Yuto", "Sota", "Yui", "Aoi", "Riku", "Hina", "Sora", "Kaito", "Mio"],
        ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto",
         "Nakamura", "Kobayashi", "Kato"],
    ),
    "Nigeria": (
        ["Chinedu", "Ngozi", "Emeka", "Ifeoma", "Oluwaseun", "Adaeze", "Tunde",
         "Amaka", "Chidi", "Folake"],
        ["Okafor", "Adeyemi", "Okonkwo", "Balogun", "Eze", "Nwosu", "Abubakar",
         "Chukwu", "Afolabi", "Uche"],
    ),
    "United Arab Emirates": (
        ["Ahmed", "Fatima", "Omar", "Layla", "Khalid", "Mariam", "Youssef", "Noor",
         "Hassan", "Sara"],
        ["Al Mansoori", "Al Suwaidi", "Al Falasi", "Al Hashimi", "Al Marri", "Al Zaabi"],
    ),
    "Singapore": (
        ["Wei Jie", "Hui Min", "Jia Hao", "Xin Yi", "Kai Wen", "Li Ting"],
        ["Tan", "Lim", "Lee", "Ng", "Wong", "Chua"],
    ),
}

# Major English-language city names per non-US country (avoids native-script
# city output and keeps locations recognizable).
CITY_POOLS = {
    "China": ["Beijing", "Shanghai", "Shenzhen", "Guangzhou", "Hong Kong"],
    "India": ["Mumbai", "New Delhi", "Bangalore", "Pune", "Hyderabad"],
    "Canada": ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"],
    "United Kingdom": ["London", "Manchester", "Edinburgh", "Birmingham"],
    "Brazil": ["São Paulo", "Rio de Janeiro", "Brasília", "Belo Horizonte"],
    "South Korea": ["Seoul", "Busan", "Incheon"],
    "Mexico": ["Mexico City", "Guadalajara", "Monterrey"],
    "Germany": ["Berlin", "Munich", "Frankfurt", "Hamburg"],
    "France": ["Paris", "Lyon", "Marseille"],
    "Nigeria": ["Lagos", "Abuja", "Port Harcourt"],
    "Japan": ["Tokyo", "Osaka", "Yokohama"],
    "Colombia": ["Bogotá", "Medellín", "Cali"],
    "Spain": ["Madrid", "Barcelona", "Valencia"],
    "Singapore": ["Singapore"],
    "United Arab Emirates": ["Dubai", "Abu Dhabi"],
}

# country -> (weight, faker locale for names or None to use NAME_POOLS)
COUNTRIES = [
    ("USA", 62, "en_US"),
    ("China", 6, None),
    ("India", 6, "en_IN"),
    ("Canada", 4, "en_CA"),
    ("United Kingdom", 4, "en_GB"),
    ("Brazil", 3, "pt_BR"),
    ("South Korea", 3, None),
    ("Mexico", 3, "es_MX"),
    ("Germany", 2, "de_DE"),
    ("France", 2, "fr_FR"),
    ("Nigeria", 2, None),
    ("Japan", 2, None),
    ("Colombia", 2, "es_MX"),
    ("Spain", 1, "es_ES"),
    ("Singapore", 1, None),
    ("United Arab Emirates", 1, None),
]

US_UNDERGRAD = [
    "University of Pennsylvania", "Cornell University", "New York University",
    "University of Michigan", "University of California, Berkeley",
    "University of California, Los Angeles", "Georgetown University",
    "University of Virginia", "Duke University", "Northwestern University",
    "Boston College", "Boston University", "University of Texas at Austin",
    "Indiana University Bloomington", "Pennsylvania State University",
    "Rutgers University", "University of Florida", "Ohio State University",
    "University of Wisconsin-Madison", "Howard University",
    "Pasadena City College", "Santa Monica College", "Baruch College",
    "University of Illinois Urbana-Champaign", "Vanderbilt University",
    "Emory University", "Washington University in St. Louis",
    "University of Southern California", "Columbia University",
    "Barnard College", "Wesleyan University", "Amherst College",
    "Morehouse College", "Spelman College", "University of Georgia",
    "Texas A&M University", "Arizona State University",
    "University of Notre Dame", "Fordham University", "Syracuse University",
]

INTL_UNDERGRAD = [
    "Tsinghua University", "Peking University", "Fudan University",
    "Indian Institute of Technology Bombay", "Indian Institute of Technology Delhi",
    "University of Delhi", "London School of Economics", "University of Oxford",
    "University of Cambridge", "University of Toronto", "McGill University",
    "University of Waterloo", "Fundação Getulio Vargas", "Universidade de São Paulo",
    "Seoul National University", "Yonsei University", "Korea University",
    "Instituto Tecnológico Autónomo de México", "Universidad de los Andes",
    "Technical University of Munich", "Sciences Po", "HEC Paris",
    "Keio University", "Waseda University", "IE University",
    "National University of Singapore", "American University of Sharjah",
]

DUAL_DEGREES = [
    "JD", "MD", "MPH", "MIA (SIPA)", "MPA (SIPA)", "MS in Biotechnology",
    "MS in Data Science", "MSW", "PhD",
]

# industry -> companies, job titles, functions
INDUSTRY_PROFILES = {
    "Consulting": {
        "companies": ["McKinsey & Company", "Boston Consulting Group", "Bain & Company",
                      "Deloitte Consulting", "EY-Parthenon", "Oliver Wyman", "Accenture Strategy"],
        "titles": ["Associate", "Senior Associate", "Consultant", "Engagement Manager"],
        "functions": ["Strategy/Consulting", "Operations", "Corporate Strategy"],
    },
    "Investment Banking": {
        "companies": ["Goldman Sachs", "JPMorgan Chase", "Morgan Stanley", "Citi",
                      "Barclays", "Evercore", "Lazard", "Bank of America"],
        "titles": ["Associate", "Vice President", "Senior Associate"],
        "functions": ["Investment Banking", "Corporate Finance"],
    },
    "Private Equity / Venture Capital": {
        "companies": ["Blackstone", "KKR", "TPG", "Carlyle Group", "General Atlantic",
                      "Insight Partners", "Vista Equity Partners"],
        "titles": ["Associate", "Senior Associate", "Vice President"],
        "functions": ["Private Equity", "Venture Capital", "Investing"],
    },
    "Technology": {
        "companies": ["Amazon", "Google", "Meta", "Microsoft", "Apple", "Uber",
                      "Salesforce", "Stripe", "Netflix", "LinkedIn"],
        "titles": ["Product Manager", "Senior Product Manager", "Program Manager",
                   "Strategy & Operations Manager", "Business Operations Manager"],
        "functions": ["Product Management", "Strategy & Operations", "Marketing", "Operations"],
    },
    "Consumer Products / Retail": {
        "companies": ["Procter & Gamble", "PepsiCo", "L'Oréal", "Unilever", "Nike",
                      "Target", "Estée Lauder Companies", "Colgate-Palmolive"],
        "titles": ["Brand Manager", "Associate Brand Manager", "Marketing Manager",
                   "Senior Brand Manager"],
        "functions": ["Marketing", "Brand Management", "Operations"],
    },
    "Healthcare / Pharmaceuticals": {
        "companies": ["Pfizer", "Johnson & Johnson", "Merck", "Novartis",
                      "UnitedHealth Group", "Bristol Myers Squibb"],
        "titles": ["Associate Product Manager", "Strategy Manager", "Senior Analyst",
                   "Commercial Strategy Manager"],
        "functions": ["Marketing", "Strategy", "Commercial Operations"],
    },
    "Financial Services (other)": {
        "companies": ["American Express", "Visa", "Mastercard", "BlackRock",
                      "Fidelity Investments", "S&P Global", "MetLife"],
        "titles": ["Associate", "Senior Associate", "Manager", "Analyst"],
        "functions": ["Corporate Finance", "Strategy", "Operations"],
    },
    "Media / Entertainment": {
        "companies": ["The Walt Disney Company", "Warner Bros. Discovery", "NBCUniversal",
                      "Spotify", "Sony Pictures"],
        "titles": ["Manager, Strategy", "Marketing Manager", "Senior Analyst"],
        "functions": ["Strategy", "Marketing", "Operations"],
    },
    "Real Estate": {
        "companies": ["CBRE", "JLL", "Related Companies", "Brookfield Properties",
                      "Tishman Speyer"],
        "titles": ["Associate", "Senior Associate", "Asset Manager"],
        "functions": ["Investing", "Asset Management", "Development"],
    },
    "Energy": {
        "companies": ["ExxonMobil", "Shell", "NextEra Energy", "Chevron"],
        "titles": ["Analyst", "Associate", "Strategy Manager"],
        "functions": ["Strategy", "Operations", "Business Development"],
    },
    "Education / Government / Nonprofit": {
        "companies": ["KIPP DC", "Teach For America", "BRICK Education Network",
                      "City of New York", "World Bank", "United Nations",
                      "Robin Hood Foundation", "New York City Department of Education"],
        "titles": ["Director of Operations", "Program Manager", "Policy Analyst",
                   "Senior Manager", "Chief of Staff"],
        "functions": ["Administration", "Operations", "Program Management", "Policy"],
    },
}

INDUSTRY_WEIGHTS = {
    "Consulting": 18,
    "Investment Banking": 13,
    "Private Equity / Venture Capital": 8,
    "Technology": 17,
    "Consumer Products / Retail": 9,
    "Healthcare / Pharmaceuticals": 7,
    "Financial Services (other)": 8,
    "Media / Entertainment": 4,
    "Real Estate": 4,
    "Energy": 3,
    "Education / Government / Nonprofit": 9,
}

INDUSTRIES = list(INDUSTRY_WEIGHTS.keys())
INDUSTRY_W = list(INDUSTRY_WEIGHTS.values())

FAKERS: dict[str, Faker] = {}


def get_faker(locale: str) -> Faker:
    if locale not in FAKERS:
        FAKERS[locale] = Faker(locale)
    return FAKERS[locale]


def weighted_choice(pairs):
    items = [p[0] for p in pairs]
    weights = [p[1] for p in pairs]
    return random.choices(items, weights=weights, k=1)[0]


def weighted_company_choice(companies: list[str]) -> str:
    anchor_count = max(1, len(companies) // ANCHOR_FRACTION)
    weights = [ANCHOR_WEIGHT] * anchor_count + [NON_ANCHOR_WEIGHT] * (len(companies) - anchor_count)
    return random.choices(companies, weights=weights, k=1)[0]


def pick_industry_bundle():
    industry = random.choices(INDUSTRIES, weights=INDUSTRY_W, k=1)[0]
    profile = INDUSTRY_PROFILES[industry]
    company = weighted_company_choice(profile["companies"])
    title = random.choice(profile["titles"])
    function = random.choice(profile["functions"])
    return industry, company, title, function


def make_name(country_name: str, locale: str | None) -> tuple[str, str]:
    if locale is None:
        first_pool, last_pool = NAME_POOLS[country_name]
        return random.choice(first_pool), random.choice(last_pool)
    person_faker = get_faker(locale)
    return person_faker.first_name(), person_faker.last_name()


def ascii_slug(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if ch.isalnum() and ch.isascii())


def apply_na_placeholders(row: list) -> list:
    return [
        NA_PLACEHOLDER if (value is None or value == "") and i < NA_PLACEHOLDER_COLUMN_COUNT else value
        for i, value in enumerate(row)
    ]


def make_row(used_emails: set) -> list:
    year = random.choice(GRAD_YEARS)

    country_name, locale = weighted_choice([((c[0], c[2]), c[1]) for c in COUNTRIES])
    first_name, last_name = make_name(country_name, locale)

    if country_name == "USA":
        us_faker = get_faker("en_US")
        state = us_faker.state_abbr()
        city = us_faker.city()
    else:
        state = ""
        city = random.choice(CITY_POOLS[country_name])

    status = random.choices(STATUS_OPTIONS, weights=STATUS_WEIGHTS, k=1)[0]

    cluster = weighted_choice(list(zip(CLUSTERS, CLUSTER_WEIGHTS)))
    if random.random() < 0.08:
        cluster = J_TERM_LABEL

    if country_name == "USA":
        undergrad = random.choice(US_UNDERGRAD) if random.random() < 0.85 else random.choice(INTL_UNDERGRAD)
    else:
        undergrad = random.choice(INTL_UNDERGRAD) if random.random() < 0.7 else random.choice(US_UNDERGRAD)

    summer_company = ""
    if random.random() < 0.85:
        _, summer_company, _, _ = pick_industry_bundle()

    ft_employer = ft_industry = ft_title = ft_function = ""

    if status == "Employed":
        ft_industry, ft_employer, ft_title, ft_function = pick_industry_bundle()
    elif status == "Returning to sponsoring company or previous employer":
        ft_industry, ft_employer, ft_title, ft_function = pick_industry_bundle()
        ft_title = random.choice(["Senior Manager", "Director", "Director of Operations", "Senior Associate"])
        summer_company = ""
    elif status == "Starting a new business":
        ft_industry = "Entrepreneurship"
        ft_employer = f"{last_name} Ventures" if random.random() < 0.5 else f"{first_name}'s Startup"
        ft_title = "Founder & CEO"
        ft_function = "Entrepreneurship"
    # "Not seeking" leaves ft_employer/ft_industry/ft_title/ft_function blank

    dual_degree = random.choice(DUAL_DEGREES) if random.random() < 0.12 else ""

    first_slug = ascii_slug(first_name) or "grad"
    last_slug = ascii_slug(last_name) or "student"
    email_local = f"{first_slug[0]}{last_slug}{str(year)[-2:]}".lower()
    email = f"{email_local}@gsb.columbia.edu"
    suffix = 1
    while email in used_emails:
        suffix += 1
        email = f"{email_local}{suffix}@gsb.columbia.edu"
    used_emails.add(email)

    row = [
        year,
        first_name,
        last_name,
        status,
        email,
        cluster,
        undergrad,
        summer_company,
        ft_employer,
        ft_industry,
        ft_title,
        ft_function,
        city,
        state,
        country_name,
        dual_degree,
    ]
    return apply_na_placeholders(row)


def main() -> None:
    wb, ws = build_workbook()
    used_emails: set = set()

    for _ in range(ROW_COUNT):
        ws.append(make_row(used_emails))

    wb.save("grad_roster.xlsx")
    print(f"Created grad_roster.xlsx with {ROW_COUNT} rows")


if __name__ == "__main__":
    main()
