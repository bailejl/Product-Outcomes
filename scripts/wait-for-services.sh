#!/bin/bash

# Wait for services to be ready script
# Used in Phase 1 setup

set -e

echo "🔍 Waiting for services to be ready..."

# Function to wait for a service
wait_for_service() {
    local service_name=$1
    local check_command=$2
    local max_attempts=30
    local attempt=1

    echo "⏳ Waiting for $service_name..."
    
    while [ $attempt -le $max_attempts ]; do
        if eval "$check_command" >/dev/null 2>&1; then
            echo "✅ $service_name is ready"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start after $max_attempts attempts"
    return 1
}

# Wait for PostgreSQL (check if port is open)
wait_for_service "PostgreSQL" "timeout 5 bash -c '</dev/tcp/localhost/5432'"

# Wait for Redis (check if port is open)
wait_for_service "Redis" "timeout 5 bash -c '</dev/tcp/localhost/6379'"

# Wait for Mailhog
wait_for_service "Mailhog" "curl -f http://localhost:8025 --max-time 5"

# Wait for MinIO
wait_for_service "MinIO" "curl -f http://localhost:9000/minio/health/live --max-time 5"

echo "🎉 All services are ready!"
echo ""
echo "📊 Service Status:"
echo "   PostgreSQL: http://localhost:5432"
echo "   Redis: http://localhost:6379"
echo "   Mailhog Web UI: http://localhost:8025"
echo "   MinIO Console: http://localhost:9001"
echo ""
echo "🚀 You can now start the application with: npm run dev:phase1"