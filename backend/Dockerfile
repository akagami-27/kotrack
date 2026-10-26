FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install available Debian security updates.
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install and verify application dependencies. pip is a build-time tool only;
# its wheel bundles stale/vulnerable vendored packages and an SBOM that Trivy
# correctly finds in the image. Remove pip from the runtime after installation.
RUN python -m pip install --no-cache-dir --upgrade pip setuptools \
    && python -m pip install --no-cache-dir -r requirements.txt \
    && python -m pip install --no-cache-dir --upgrade "urllib3>=2.8.0" "msgpack>=1.2.1" \
    && python -m pip check \
    && python -c 'from importlib.metadata import version; from packaging.version import Version; requirements = {"msgpack": "1.2.1", "setuptools": "78.1.1", "urllib3": "2.8.0"}; actual = {name: version(name) for name in requirements}; print(actual); assert all(Version(actual[name]) >= Version(minimum) for name, minimum in requirements.items())' \
    && python -m pip uninstall --yes pip

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
