#!/bin/bash

set -e

echo "🛑 Stopping Product Outcomes Monitoring Stack..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Stop monitoring stack
print_status "Stopping monitoring services..."
docker-compose -f docker-compose.monitoring.yml down

# Option to remove volumes
read -p "Do you want to remove monitoring data volumes? (y/N): " remove_volumes

if [[ $remove_volumes =~ ^[Yy]$ ]]; then
    print_warning "Removing monitoring data volumes..."
    docker-compose -f docker-compose.monitoring.yml down -v
    print_status "Monitoring data volumes removed."
else
    print_status "Monitoring data volumes preserved."
fi

print_status "Monitoring stack stopped successfully!"

echo ""
echo "💡 To restart monitoring:"
echo "   ./scripts/start-monitoring.sh"