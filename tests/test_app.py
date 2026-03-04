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
