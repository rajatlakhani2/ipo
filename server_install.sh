#!/bin/bash
# Run on SpidyHost: bash server_install.sh
set -e
cd /home/kuhuorgi/ipo.kuhu.org.in

echo "=== Finding virtualenv ==="
ACTIVATE=$(ls -d /home/kuhuorgi/virtualenv/ipo.kuhu.org.in/*/bin/activate 2>/dev/null | sort -V | tail -1)
if [ -z "$ACTIVATE" ]; then
  echo "ERROR: No virtualenv found under ~/virtualenv/ipo.kuhu.org.in/"
  exit 1
fi
# shellcheck disable=SC1090
source "$ACTIVATE"
echo "Using: $VIRTUAL_ENV"
echo "Python: $(python --version)"

echo "=== Installing packages ==="
pip install --upgrade pip
pip install -r requirements-cpanel.txt

echo "=== Testing app ==="
python check_deps.py 2>&1 | tee install_check.log

echo "=== Touch Passenger restart ==="
mkdir -p tmp
touch tmp/restart.txt

echo "DONE. Now click RESTART in cPanel, then open /api/health"
