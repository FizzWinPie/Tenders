from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_read_root():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json() == {"message": "Welcome to app"}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"message": "Server is healthy"}


def test_run_filtered_search_empty():
    r = client.post("/run-filtered-search", json={})
    assert r.status_code == 200
    data = r.json()
    assert "publication_date" in data
    assert "total_count" in data
    assert "tenders" in data
    assert isinstance(data["tenders"], list)


def test_select_keywords_empty_input():
    from app.clients.gemini import select_keywords

    assert select_keywords("") == []


def test_select_keywords_no_api_key_returns_empty():
    from app.clients.gemini import select_keywords

    with patch("app.clients.gemini.GEMINI_API_KEY", None):
        result = select_keywords("SAP Cloud ERP company text")
    assert result == []


def test_select_keywords_returns_parsed_list():
    from app.clients.gemini import select_keywords

    fake_res = MagicMock()
    fake_res.text = '["SAP Cloud ERP", "S/4HANA", "Mittelstand"]'

    with patch("app.clients.gemini.GEMINI_API_KEY", "test-key"):
        with patch("app.clients.gemini.genai.Client") as mock_client:
            mock_client.return_value.models.generate_content.return_value = fake_res
            result = select_keywords("Some company description")
    assert result == ["SAP Cloud ERP", "S/4HANA", "Mittelstand"]


def test_select_keywords_handles_markdown_fence():
    from app.clients.gemini import select_keywords

    fake_res = MagicMock()
    fake_res.text = '```json\n["SAP", "Cloud"]\n```'

    with patch("app.clients.gemini.GEMINI_API_KEY", "test-key"):
        with patch("app.clients.gemini.genai.Client") as mock_client:
            mock_client.return_value.models.generate_content.return_value = fake_res
            result = select_keywords("Company text")
    assert result == ["SAP", "Cloud"]
