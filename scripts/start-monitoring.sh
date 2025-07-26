#!/bin/bash

set -e

echo "🚀 Starting Product Outcomes Monitoring Stack..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose could not be found. Please install docker-compose."
    exit 1
fi

# Create necessary directories
print_status "Creating monitoring directories..."
mkdir -p monitoring/{prometheus/rules,grafana/{dashboards,datasources},alertmanager,loki,promtail}
mkdir -p /tmp/monitoring-logs

# Start the monitoring stack
print_status "Starting monitoring infrastructure..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 10

# Check service health
check_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:$port" > /dev/null 2>&1; then
            print_status "$service_name is ready!"
            return 0
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "$service_name failed to start after $max_attempts attempts"
            return 1
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
}

print_status "Checking service health..."

# Check Prometheus
echo -n "Prometheus"
check_service "Prometheus" 9090

# Check Grafana
echo -n "Grafana"
check_service "Grafana" 3001

# Check AlertManager
echo -n "AlertManager"
check_service "AlertManager" 9093

# Check Node Exporter
echo -n "Node Exporter"
check_service "Node Exporter" 9100

print_status "All monitoring services are running!"

echo ""
echo "🎉 Monitoring Stack Started Successfully!"
echo ""
echo "📊 Access your monitoring tools:"
echo "   • Prometheus:    http://localhost:9090"
echo "   • Grafana:       http://localhost:3001 (admin/admin123)"
echo "   • AlertManager:  http://localhost:9093"
echo "   • Jaeger:        http://localhost:16686"
echo "   • Node Exporter: http://localhost:9100"
echo ""
echo "📈 API Metrics:"
echo "   • Metrics:       http://localhost:3333/api/metrics"
echo "   • Business:      http://localhost:3333/api/business-metrics"
echo "   • Health:        http://localhost:3333/api/health-metrics"
echo ""
echo "🔗 To view logs: docker-compose -f docker-compose.monitoring.yml logs -f"
echo "🛑 To stop: docker-compose -f docker-compose.monitoring.yml down"