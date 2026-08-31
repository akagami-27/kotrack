from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_documentation_is_available():
    response = client.get("/openapi.json")

    assert response.status_code == 200

    data = response.json()

    assert "/api/health" in data["paths"]
    assert "/api/auth/register" in data["paths"]
    assert "/api/auth/login" in data["paths"]
    assert "/api/users/me" in data["paths"]
    assert "/api/balance/me" in data["paths"]
    assert "/api/sessions" in data["paths"]
    assert "/api/payments" in data["paths"]