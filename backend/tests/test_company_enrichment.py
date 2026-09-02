from openpyxl import Workbook

from backend.etl.company_enrichment import extract_company_names_from_roster, normalize_company_payload


def test_normalize_company_payload_keeps_core_fields():
    payload = {
        "name": "Google LLC",
        "domain": "google.com",
        "year_founded": 1998,
        "industry": "Internet",
        "description": "Search and cloud company",
        "employee_count": 180000,
        "location": {"city": "Mountain View", "country": "United States"},
        "company_size": "10001+",
        "website": "https://google.com",
    }

    normalized = normalize_company_payload(payload)

    assert normalized["name"] == "Google LLC"
    assert normalized["domain"] == "google.com"
    assert normalized["industry"] == "Internet"
    assert normalized["employee_count"] == 180000
    assert normalized["city"] == "Mountain View"
    assert normalized["country"] == "United States"
    assert normalized["website"] == "https://google.com"


def test_extract_company_names_from_roster():
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Graduating year", "FT employer name", "FT job title"])
    sheet.append([2024, "Google", "Product Manager"])
    sheet.append([2024, "Microsoft", "Program Manager"])
    sheet.append([2024, "", "Analyst"])
    sheet.append([2024, "Google", "Strategy Manager"])

    names = extract_company_names_from_roster(sheet)

    assert names == ["Google", "Microsoft"]
