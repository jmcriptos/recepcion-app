# Meat Reception API

Flask RESTful API server for the Meat Reception Application.

## Prerequisites

- Python 3.11+
- PostgreSQL 15.x
- Redis (optional, for caching)

## Local Development Setup

### 1. Environment Setup

Create a Python virtual environment:

```bash
# From the project root directory
cd apps/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
# Install production dependencies
pip install -r requirements.txt

# Install development dependencies (includes testing tools)
pip install -r requirements-dev.txt
```

### 3. PostgreSQL Database Setup

Install and configure PostgreSQL:

**On macOS (using Homebrew):**
```bash
# Install PostgreSQL
brew install postgresql

# Start PostgreSQL service
brew services start postgresql

# Create database user (optional, for better security)
createuser -d -P meat_reception_user
# Enter password when prompted: meat_reception_dev

# Create development database
createdb -O meat_reception_user meat_reception_dev

# Create test database
createdb -O meat_reception_user meat_reception_test
```

**On Ubuntu/Debian:**
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Switch to postgres user and create database
sudo -u postgres psql
CREATE USER meat_reception_user WITH PASSWORD 'meat_reception_dev';
CREATE DATABASE meat_reception_dev OWNER meat_reception_user;
CREATE DATABASE meat_reception_test OWNER meat_reception_user;
\q
```

### 4. Environment Configuration

Create a `.env` file in the `apps/api` directory:

```bash
# Copy example environment file
cp .env.example .env
```

Required environment variables:

```bash
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://meat_reception_user:meat_reception_dev@localhost:5432/meat_reception_dev
REDIS_URL=redis://localhost:6379
CLOUDINARY_URL=cloudinary://api-key:api-secret@cloud-name
GOOGLE_VISION_API_KEY=optional-google-vision-key
LOG_LEVEL=DEBUG
FLASK_ENV=development
TESTING=false
```

### 5. Database Migration Setup

```bash
# Run migrations to create tables
cd apps/api/src
PYTHONPATH=. python -m flask --app wsgi db upgrade

# Or using environment variables
export FLASK_APP=src/wsgi.py
export FLASK_ENV=development
cd apps/api
flask db upgrade
```

### 6. Running the Application

```bash
# Development server
flask run

# Or using the WSGI entry point
python src/wsgi.py
```

The API will be available at `http://localhost:5000`

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/unit/test_models.py

# Run integration tests only
pytest tests/integration/
```

## Project Structure

```
apps/api/
├── src/
│   ├── app/
│   │   ├── __init__.py       # Flask app factory
│   │   ├── config.py         # Configuration management
│   │   ├── routes/           # API controllers
│   │   ├── services/         # Business logic
│   │   ├── models/           # SQLAlchemy models
│   │   ├── utils/            # Backend utilities
│   │   └── middleware/       # Flask middleware
│   └── wsgi.py               # WSGI entry point for Heroku
├── migrations/               # Database migrations (Flask-Migrate)
├── tests/                    # Backend tests
├── requirements.txt          # Python dependencies
├── requirements-dev.txt      # Development dependencies
├── runtime.txt              # Python version for Heroku
└── README.md                # This file
```

## API Documentation

API documentation will be available at `/docs` when implemented with Flask-RESTX or similar.

## Deployment

This application is configured for Heroku deployment with:

- `runtime.txt` specifying Python version
- `wsgi.py` as the WSGI entry point
- Environment-based configuration
- PostgreSQL and Redis add-on support

## Development Commands

```bash
# Format code
black src/ tests/

# Sort imports
isort src/ tests/

# Lint code
flake8 src/ tests/

# Type checking
mypy src/

# Security scanning
bandit -r src/
```