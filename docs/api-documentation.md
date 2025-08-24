# API Documentation - Health Check & System Monitoring

This document provides comprehensive documentation for the health check and system monitoring endpoints in the Meat Reception API.

## Base URLs

- **Development:** `http://localhost:5000`
- **Staging:** `https://meat-reception-staging.herokuapp.com`
- **Production:** `https://meat-reception-api-prod.herokuapp.com`

## Authentication

The health check endpoints do not require authentication and are publicly accessible for monitoring purposes.

## API Versioning

All API endpoints include version headers:
- `X-API-Version`: Current API version (v1)
- `X-API-Deprecated`: Deprecation status (true/false)

## Endpoints

### GET /health

Comprehensive health check endpoint that returns system status and operational metrics.

**Request:**
```
GET /health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-20T10:30:45.123456Z",
  "database_connected": true,
  "environment": "production",
  "version": "abc12345",
  "uptime_seconds": 86400,
  "memory_usage_percent": 45.2,
  "cpu_usage_percent": 12.8
}
```

**Response (503 Service Unavailable) - Unhealthy:**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-08-20T10:30:45.123456Z",
  "database_connected": false,
  "environment": "production",
  "version": "abc12345",
  "uptime_seconds": 86400,
  "memory_usage_percent": 45.2,
  "cpu_usage_percent": 12.8
}
```

**Response Fields:**
- `status` (string): Overall system health status ("healthy" or "unhealthy")
- `timestamp` (string): Current server timestamp in ISO 8601 format
- `database_connected` (boolean): PostgreSQL database connectivity status
- `environment` (string): Current environment (development/testing/production)
- `version` (string): Application version (Heroku commit hash or fallback)
- `uptime_seconds` (integer): System uptime in seconds since boot
- `memory_usage_percent` (float): Current memory usage percentage
- `cpu_usage_percent` (float): Current CPU usage percentage

**HTTP Status Codes:**
- `200`: System is healthy (database connected)
- `503`: System is unhealthy (database connection failed)

---

### GET /api/v1/ping

API v1 ping endpoint for connectivity testing with performance metrics.

**Request:**
```
GET /api/v1/ping
```

**Response (200 OK):**
```json
{
  "message": "pong",
  "timestamp": "2025-08-20T10:30:45.123456Z",
  "database_connected": true,
  "response_time_ms": 45.23,
  "database_response_time_ms": 12.45
}
```

**Response (200 OK) - Database Unavailable:**
```json
{
  "message": "pong",
  "timestamp": "2025-08-20T10:30:45.123456Z",
  "database_connected": false,
  "response_time_ms": 45.23,
  "database_response_time_ms": null
}
```

**Response Fields:**
- `message` (string): Always returns "pong" for successful requests
- `timestamp` (string): Server timestamp in ISO 8601 format
- `database_connected` (boolean): PostgreSQL database connectivity status
- `response_time_ms` (float): Total response time in milliseconds
- `database_response_time_ms` (float|null): Database query response time in milliseconds

**HTTP Status Codes:**
- `200`: Ping successful (endpoint always returns 200, check database_connected field)

**Headers:**
- `X-API-Version: v1`: API version identifier
- `X-API-Deprecated: false`: Deprecation status
- `X-Request-ID: uuid`: Unique request identifier for debugging

---

## Error Handling

All endpoints use standardized error response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "timestamp": "2025-08-20T10:30:45.123456Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `HTTP_404` | 404 | Endpoint not found |
| `HTTP_405` | 405 | Method not allowed |
| `DATABASE_ERROR` | 503 | Database connectivity issues |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Performance Targets

| Endpoint | Target Response Time | Notes |
|----------|---------------------|-------|
| `/health` | < 200ms | Includes system metrics collection |
| `/api/v1/ping` | < 100ms | Minimal connectivity test |

## Troubleshooting

### Common Issues

**1. Health check returns 503 status**
- **Cause:** Database connection failure
- **Check:** Verify `DATABASE_URL` environment variable
- **Verify:** Check Heroku Postgres addon status: `heroku pg:info`
- **Solution:** Restart application or check database connectivity

**2. System metrics show null values**
- **Cause:** System monitoring (psutil) not available
- **Check:** Verify `psutil` package is installed
- **Solution:** Check requirements.txt and redeploy

**3. High response times**
- **Cause:** Database connection pool exhaustion
- **Check:** Monitor database connection count
- **Solution:** Increase connection pool size or investigate slow queries

### Monitoring Integration

These endpoints are designed for integration with monitoring systems:

- **Health checks:** Use `/health` for comprehensive system monitoring
- **Uptime monitoring:** Use `/api/v1/ping` for basic connectivity checks
- **Alerting:** Alert on 503 status codes from `/health`
- **Metrics:** Track response times and system resource usage

### Request Correlation

All requests include a unique `X-Request-ID` header for log correlation and debugging. Include this ID when reporting issues.

---

## Examples

### cURL Examples

**Basic health check:**
```bash
curl -i https://meat-reception-api-prod.herokuapp.com/health
```

**API v1 ping with timing:**
```bash
curl -w "Total time: %{time_total}s\n" \
  https://meat-reception-api-prod.herokuapp.com/api/v1/ping
```

### Monitoring Script Example

```bash
#!/bin/bash
# Basic monitoring script
HEALTH_URL="https://your-app.herokuapp.com/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✓ API healthy"
else
    echo "✗ API unhealthy (HTTP $RESPONSE)"
    exit 1
fi
```

---

*Last updated: 2025-08-20 | API Version: v1*